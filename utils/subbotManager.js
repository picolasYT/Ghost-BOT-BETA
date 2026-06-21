import { Boom } from "@hapi/boom";
import { bindBaileysEvents, createBaileysSessionRuntime } from "./baileysCompat.js";

const subbotStore = global.subbotStore || (global.subbotStore = new Map());

function cleanPhone(text = "") {
  return text.replace(/\D/g, "");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createEntry(phone) {
  const existing = subbotStore.get(phone);
  if (existing) return existing;

  const entry = {
    phone,
    client: null,
    sock: null,
    status: "idle",
    pairingCode: "",
    error: "",
    ownerChat: "",
    authPath: "",
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

async function notify(mainClient, ownerChat, text) {
  if (!mainClient || !ownerChat || !text) return;
  try {
    await mainClient.sendMessage(ownerChat, text);
  } catch {}
}

function buildCommandContext({
  subClient,
  mainClient,
  config,
  MessageMedia,
  fs,
  path,
  cacheDir
}) {
  subClient.commands = mainClient?.commands || new Map();

  return async function handleCommand(message) {
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
  };
}

function normalizeDisconnectReason(reason) {
  const statusCode = new Boom(reason?.error)?.output?.statusCode;
  return String(statusCode || reason || "desconectado");
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

export function listPublicSubbots() {
  return [];
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

  try {
    await entry.client.logout?.();
  } catch {}

  try {
    await entry.client.destroy?.();
  } catch {}

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
  if (existing?.client && existing.status !== "error" && existing.status !== "disconnected") {
    throw new Error("Ese numero ya tiene un subbot iniciado.");
  }

  const entry = createEntry(normalizedPhone);
  touchEntry(entry, {
    client: null,
    sock: null,
    status: "starting",
    pairingCode: "",
    error: "",
    ownerChat
  });

  const runtime = await createBaileysSessionRuntime({
    clientId: `ghost-subbot-${normalizedPhone}`,
    botName: `${config.botName || "Ghost-Bot"} Subbot`,
    authPath: config.authPath,
    isSubbot: true
  });

  const { sock, client, authPath: sessionDir, MessageMedia: CompatMessageMedia, isRegistered } = runtime;

  client.mainClientRef = mainClient || null;
  client.subbotMeta = {
    phone: normalizedPhone,
    clientId: `ghost-subbot-${normalizedPhone}`,
    ownerChat,
    authPath: config.authPath || "./data/auth",
    sessionDir
  };

  touchEntry(entry, {
    client,
    sock,
    authPath: sessionDir,
    status: isRegistered ? "registered" : "starting"
  });

  const handleCommand = buildCommandContext({
    subClient: client,
    mainClient,
    config,
    MessageMedia: CompatMessageMedia || MessageMedia,
    fs,
    path,
    cacheDir
  });

  await bindBaileysEvents({
    sock,
    client,
    handleCommand,
    onReconnect: async () => {
      touchEntry(entry, { status: "reconnecting" });
    }
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      touchEntry(entry, { status: "ready", error: "" });
      if (notifyOwner) {
        await notify(mainClient, ownerChat, "👻 Subbot conectado y listo para usar comandos.");
      }
    }

    if (connection === "close") {
      const reasonText = normalizeDisconnectReason(lastDisconnect);

      if (reasonText === "401" && entry.status === "pairing_code_ready") {
        return;
      }

      touchEntry(entry, {
        status: "disconnected",
        error: reasonText
      });
      if (notifyOwner) {
        await notify(mainClient, ownerChat, `⚠️ Subbot desconectado: ${reasonText}`);
      }
    }
  });

  if (isRegistered) {
    touchEntry(entry, {
      status: "ready",
      error: "",
      pairingCode: ""
    });

    return {
      phone: normalizedPhone,
      pairingCode: "YA_VINCULADO",
      clientId: client.subbotMeta.clientId
    };
  }

  await delay(1500);

  try {
    const pairingCode = await sock.requestPairingCode(normalizedPhone);
    touchEntry(entry, {
      status: "pairing_code_ready",
      pairingCode,
      error: ""
    });

    return {
      phone: normalizedPhone,
      pairingCode,
      clientId: client.subbotMeta.clientId
    };
  } catch (error) {
    const message = String(error?.message || "No se pudo generar el codigo.");
    touchEntry(entry, {
      client: null,
      sock: null,
      status: "error",
      error: message
    });

    try {
      await client.destroy?.();
    } catch {}

    throw new Error(message);
  }
}
