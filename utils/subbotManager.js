const subbotStore = global.subbotStore || (global.subbotStore = new Map());

function cleanPhone(text = "") {
  return text.replace(/\D/g, "");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadWhatsappWeb() {
  const mod = await import("whatsapp-web.js");
  return mod.default || mod;
}

function getSubbotClientId(phone) {
  return `ghost-subbot-${phone}`;
}

function createEntry(phone) {
  const existing = subbotStore.get(phone);
  if (existing) return existing;

  const entry = {
    phone,
    client: null,
    status: "idle",
    pairingCode: "",
    error: "",
    ownerChat: "",
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  subbotStore.set(phone, entry);
  return entry;
}

function touchEntry(entry, patch = {}) {
  Object.assign(entry, patch, { updatedAt: Date.now() });
  return entry;
}

function destroyQuietly(client) {
  if (!client) return;

  try {
    const maybePromise = client.destroy?.();
    if (maybePromise?.catch) {
      maybePromise.catch(() => {});
    }
  } catch {}
}

function buildSubbotErrorMessage(error, config) {
  const message = String(error?.message || error || "");
  const lowered = message.toLowerCase();

  if (lowered.includes("could not find chrome")) {
    const chromePath = config?.chromePath || "sin definir";
    return [
      "No se pudo iniciar el subbot porque Chrome/Chromium no esta disponible en este entorno.",
      `CHROME_PATH actual: ${chromePath}`,
      "En Render tenes que instalar Chrome/Chromium o definir CHROME_PATH a un ejecutable valido.",
      "Mientras eso no exista, la web no puede generar pairing codes con whatsapp-web.js."
    ].join(" ");
  }

  return message || "No se pudo iniciar el subbot.";
}

async function startCommandHandler({ subClient, mainClient, config, MessageMedia, fs, path, cacheDir }) {
  if (!mainClient?.commands) return;

  subClient.commands = mainClient.commands;

  async function handleCommand(message) {
    try {
      if (!message?.body) return;
      if (!message.body.startsWith(config.prefix)) return;

      const args = message.body
        .slice(config.prefix.length)
        .trim()
        .split(/\s+/);

      const commandName = args.shift()?.toLowerCase();
      if (!commandName) return;

      const command = subClient.commands.get(commandName);
      if (!command) return;

      await command.execute({
        client: subClient,
        message,
        args,
        config,
        MessageMedia,
        fs,
        path,
        cacheDir,
        reply: (content, options) => message.reply(content, undefined, options)
      });
    } catch (error) {
      console.error("Error en subbot:", error);
      try {
        await message.reply("❌ Error ejecutando comando en subbot.");
      } catch {}
    }
  }

  subClient.on("message", async (message) => {
    if (!message.fromMe) await handleCommand(message);
  });

  subClient.on("message_create", async (message) => {
    if (message.fromMe) await handleCommand(message);
  });
}

async function notify(mainClient, ownerChat, text) {
  if (!mainClient || !ownerChat || !text) return;
  try {
    await mainClient.sendMessage(ownerChat, text);
  } catch {}
}

export function listSubbots() {
  return [...subbotStore.values()].map((entry) => ({
    phone: entry.phone,
    status: entry.status,
    pairingCode: entry.pairingCode,
    error: entry.error,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  }));
}

export function getSubbot(phone) {
  const normalized = cleanPhone(phone);
  return normalized ? subbotStore.get(normalized) || null : null;
}

export async function stopSubbot(phone) {
  const normalized = cleanPhone(phone);
  if (!normalized) {
    throw new Error("Numero invalido.");
  }

  const entry = subbotStore.get(normalized);
  if (!entry?.client) {
    throw new Error("No encontre un subbot activo con ese numero.");
  }

  touchEntry(entry, { status: "stopping" });
  await entry.client.destroy();
  subbotStore.delete(normalized);
}

export async function startSubbot({
  phone,
  mainClient,
  config,
  MessageMedia,
  fs,
  path,
  cacheDir,
  ownerChat = "",
  notifyOwner = true
}) {
  const normalizedPhone = cleanPhone(phone);

  if (!normalizedPhone || normalizedPhone.length < 8) {
    throw new Error("El numero debe ir con codigo de pais y sin +, espacios ni guiones.");
  }

  const existing = subbotStore.get(normalizedPhone);
  if (existing?.client && existing.status !== "error") {
    throw new Error("Ese numero ya tiene un subbot iniciado.");
  }

  const { Client, LocalAuth, MessageMedia: SubbotMessageMedia } = await loadWhatsappWeb();
  const clientId = getSubbotClientId(normalizedPhone);
  const subClient = new Client({
    authStrategy: new LocalAuth({
      clientId,
      dataPath: config.authPath || "./data/auth"
    }),
    puppeteer: {
      headless: config.headless !== false,
      ...(config.chromePath ? { executablePath: config.chromePath } : {}),
      args: [
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        ...(config.disableSandbox !== "false"
          ? ["--no-sandbox", "--disable-setuid-sandbox"]
          : [])
      ]
    }
  });

  subClient.isSubbot = true;
  subClient.mainClientRef = mainClient || null;
  subClient.subbotMeta = {
    phone: normalizedPhone,
    clientId,
    ownerChat,
    authPath: config.authPath || "./data/auth"
  };

  const entry = createEntry(normalizedPhone);
  touchEntry(entry, {
    client: subClient,
    status: "starting",
    pairingCode: "",
    error: "",
    ownerChat
  });

  await startCommandHandler({
    subClient,
    mainClient,
    config,
    MessageMedia: SubbotMessageMedia || MessageMedia,
    fs,
    path,
    cacheDir
  });

  subClient.on("authenticated", async () => {
    touchEntry(entry, { status: "authenticated", error: "" });
    if (notifyOwner) {
      await notify(mainClient, ownerChat, "✅ Subbot autenticado correctamente.");
    }
  });

  subClient.on("ready", async () => {
    touchEntry(entry, { status: "ready", error: "" });
    if (notifyOwner) {
      await notify(mainClient, ownerChat, "👻 Subbot conectado y listo para usar comandos.");
    }
  });

  subClient.on("disconnected", async (reason) => {
    touchEntry(entry, {
      status: "disconnected",
      error: String(reason || "")
    });
    if (notifyOwner) {
      await notify(mainClient, ownerChat, `⚠️ Subbot desconectado: ${reason}`);
    }
  });

  subClient.on("auth_failure", async (reason) => {
    touchEntry(entry, {
      status: "error",
      error: String(reason || "sin detalle")
    });
    if (notifyOwner) {
      await notify(
        mainClient,
        ownerChat,
        `❌ Fallo la autenticacion del subbot: ${reason || "sin detalle"}`
      );
    }
  });

  subClient.on("change_state", (state) => {
    touchEntry(entry, { status: String(state || "unknown").toLowerCase() });
    console.log(`Estado subbot ${normalizedPhone}: ${state}`);
  });

  try {
    await subClient.initialize();
  } catch (error) {
    const friendlyMessage = buildSubbotErrorMessage(error, config);
    touchEntry(entry, {
      client: null,
      status: "error",
      error: friendlyMessage
    });
    destroyQuietly(subClient);
    throw new Error(friendlyMessage);
  }

  await wait(7000);

  if (typeof subClient.requestPairingCode !== "function") {
    touchEntry(entry, {
      status: "error",
      error: "Tu version de whatsapp-web.js no soporta codigo de emparejamiento."
    });
    throw new Error(
      "Tu version de whatsapp-web.js no soporta codigo de emparejamiento. Actualiza con npm i whatsapp-web.js@latest"
    );
  }

  try {
    const pairingCode = await subClient.requestPairingCode(normalizedPhone);
    touchEntry(entry, {
      status: "pairing_code_ready",
      pairingCode,
      error: ""
    });
    return {
      phone: normalizedPhone,
      pairingCode,
      clientId
    };
  } catch (error) {
    const friendlyMessage = buildSubbotErrorMessage(error, config);
    touchEntry(entry, {
      client: null,
      status: "error",
      error: friendlyMessage
    });
    destroyQuietly(subClient);
    throw new Error(friendlyMessage);
  }
}
