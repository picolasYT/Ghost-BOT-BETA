import fs from "fs";
import { Boom } from "@hapi/boom";
import { bindBaileysEvents, createBaileysSessionRuntime } from "./baileysCompat.js";

const subbotStore = global.subbotStore || (global.subbotStore = new Map());

function cleanPhone(text = "") {
  return text.replace(/\D/g, "");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function destroyClient(client) {
  try {
    await client?.logout?.();
  } catch {}

  try {
    await client?.destroy?.();
  } catch {}
}

async function closeClient(client) {
  try {
    await client?.destroy?.();
  } catch {}
}

function removeSessionDir(sessionDir = "") {
  if (!sessionDir) return;
  try {
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
  } catch {}
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
    restartPromise: null,
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
        await message.reply("Error ejecutando comando en subbot.");
      } catch {}
    }
  };
}

function normalizeDisconnectReason(reason) {
  const statusCode = new Boom(reason?.error)?.output?.statusCode;
  return String(statusCode || reason || "desconectado");
}

async function waitForSocketOpen(sock, timeoutMs = 5000) {
  return await new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(false);
    }, timeoutMs);

    sock.ev.on("connection.update", ({ connection }) => {
      if (settled) return;
      if (connection === "open") {
        settled = true;
        clearTimeout(timer);
        resolve(true);
      }
    });
  });
}

function attachSubbotLifecycle({ sock, entry, mainClient, ownerChat, notifyOwner }) {
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      touchEntry(entry, { status: "ready", error: "" });
      if (notifyOwner) {
        await notify(mainClient, ownerChat, "Subbot conectado y listo para usar comandos.");
      }
    }

    if (connection === "close") {
      const reasonText = normalizeDisconnectReason(lastDisconnect);

      if (reasonText === "401" && entry.status === "pairing_code_ready") {
        return;
      }

      if (
        reasonText === "408" &&
        ["starting", "registered", "pairing_code_ready", "reconnecting"].includes(entry.status)
      ) {
        touchEntry(entry, {
          status: entry.status === "pairing_code_ready" ? "pairing_code_ready" : "reconnecting",
          error: ""
        });
        return;
      }

      touchEntry(entry, {
        status: "disconnected",
        error: reasonText
      });

      if (notifyOwner) {
        await notify(mainClient, ownerChat, `Subbot desconectado: ${reasonText}`);
      }
    }
  });
}

async function requestPairingCode({
  runtime,
  entry,
  normalizedPhone
}) {
  await delay(3000);

  const pairingCode = await runtime.sock.requestPairingCode(normalizedPhone);
  touchEntry(entry, {
    status: "pairing_code_ready",
    pairingCode,
    error: ""
  });

  return pairingCode;
}

async function bootSubbotRuntime({
  normalizedPhone,
  mainClient,
  config,
  MessageMedia,
  fs,
  path,
  cacheDir,
  entry,
  ownerChat,
  notifyOwner,
  onReconnectRuntime
}) {
  const clientId = `ghost-subbot-${normalizedPhone}`;
  const runtime = await createBaileysSessionRuntime({
    clientId,
    botName: `${config.botName || "Ghost-Bot"} Subbot`,
    authPath: config.authPath,
    isSubbot: true
  });

  const { sock, client, authPath: sessionDir, MessageMedia: CompatMessageMedia } = runtime;

  client.mainClientRef = mainClient || null;
  client.subbotMeta = {
    phone: normalizedPhone,
    clientId,
    ownerChat,
    authPath: config.authPath || "./data/auth",
    sessionDir
  };

  touchEntry(entry, {
    client,
    sock,
    authPath: sessionDir,
    status: runtime.isRegistered ? "registered" : "starting",
    pairingCode: "",
    error: ""
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
    showQr: false,
    patchMainState: false,
    botLabel: `Subbot ${normalizedPhone}`,
    onReconnect: async () => {
      touchEntry(entry, { status: "reconnecting" });
      await onReconnectRuntime?.();
    }
  });

  attachSubbotLifecycle({
    sock,
    entry,
    mainClient,
    ownerChat,
    notifyOwner
  });

  return runtime;
}

async function restartSubbotRuntime(context) {
  const { entry } = context;

  if (entry.restartPromise) {
    return await entry.restartPromise;
  }

  entry.restartPromise = (async () => {
    const previousClient = entry.client;
    await closeClient(previousClient);

    const runtime = await bootSubbotRuntime({
      ...context,
      onReconnectRuntime: async () => {
        await restartSubbotRuntime(context);
      }
    });

    if (!runtime.isRegistered) {
      try {
        const pairingCode = await requestPairingCode({
          runtime,
          entry,
          normalizedPhone: context.normalizedPhone
        });

        if (context.notifyOwner) {
          await notify(
            context.mainClient,
            context.ownerChat,
            `Nuevo codigo de emparejamiento para ${context.normalizedPhone}:\n${pairingCode}`
          );
        }
      } catch (error) {
        touchEntry(entry, {
          status: "error",
          error: String(error?.message || error || "No se pudo regenerar el codigo.")
        });
      }
    }

    return runtime;
  })();

  try {
    return await entry.restartPromise;
  } finally {
    entry.restartPromise = null;
  }
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
    await destroyClient(entry.client);
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
  if (existing?.status === "pairing_code_ready" && existing.pairingCode) {
    return {
      phone: normalizedPhone,
      pairingCode: existing.pairingCode,
      clientId: existing.client?.subbotMeta?.clientId || `ghost-subbot-${normalizedPhone}`,
      alreadyLinked: false
    };
  }

  if (existing?.status === "ready" || existing?.status === "registered") {
    return {
      phone: normalizedPhone,
      pairingCode: "YA_VINCULADO",
      clientId: existing.client?.subbotMeta?.clientId || `ghost-subbot-${normalizedPhone}`,
      alreadyLinked: true
    };
  }

  if (existing?.client && existing.status !== "error" && existing.status !== "disconnected") {
    throw new Error("Ese numero ya tiene un subbot iniciandose. Espera unos segundos y proba de nuevo.");
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

  let runtime = await bootSubbotRuntime({
    normalizedPhone,
    mainClient,
    config,
    MessageMedia,
    fs,
    path,
    cacheDir,
    entry,
    ownerChat,
    notifyOwner,
    onReconnectRuntime: async () => {
      await restartSubbotRuntime({
        normalizedPhone,
        mainClient,
        config,
        MessageMedia,
        fs,
        path,
        cacheDir,
        entry,
        ownerChat,
        notifyOwner
      });
    }
  });

  if (runtime.isRegistered) {
    const opened = await waitForSocketOpen(runtime.sock, 5000);

    if (opened) {
      touchEntry(entry, {
        status: "ready",
        error: "",
        pairingCode: ""
      });

      return {
        phone: normalizedPhone,
        pairingCode: "YA_VINCULADO",
        clientId: runtime.client.subbotMeta.clientId,
        alreadyLinked: true
      };
    }

    try {
      await closeClient(runtime.client);
    } catch {}

    removeSessionDir(runtime.authPath);

    runtime = await bootSubbotRuntime({
      normalizedPhone,
      mainClient,
      config,
      MessageMedia,
      fs,
      path,
      cacheDir,
      entry,
      ownerChat,
      notifyOwner,
      onReconnectRuntime: async () => {
        await restartSubbotRuntime({
          normalizedPhone,
          mainClient,
          config,
          MessageMedia,
          fs,
          path,
          cacheDir,
          entry,
          ownerChat,
          notifyOwner
        });
      }
    });
  }

  try {
    const pairingCode = await requestPairingCode({
      runtime,
      entry,
      normalizedPhone
    });

    return {
      phone: normalizedPhone,
      pairingCode,
      clientId: runtime.client.subbotMeta.clientId,
      alreadyLinked: false
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
      await destroyClient(runtime.client);
    } catch {}

    throw new Error(message);
  }
}
