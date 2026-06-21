import "dotenv/config";
import fs from "fs";
import path from "path";
import qrcode from "qrcode-terminal";
import config from "./config.js";
import { loadPlugins } from "./utils/loadPlugins.js";
import { createClient as createLegacyClient } from "./utils/createClient.js";
import {
  bindBaileysEvents,
  createBaileysRuntime,
  maybeRequestPairingCode
} from "./utils/baileysCompat.js";
import { getStartupHints } from "./utils/runtime.js";
import {
  formatId,
  installPrettyConsole,
  logBanner,
  logError,
  logInfo,
  logStep,
  logSuccess,
  logWarn
} from "./utils/logger.js";
import { startWebServer } from "./utils/webServer.js";
import { patchBotState } from "./utils/appState.js";

const CACHE_DIR = path.resolve("./cache");
const WEB_PORT = Number.isFinite(config.webPort) ? config.webPort : 3000;
const WEB_HOST = config.webHost || "0.0.0.0";
let latestBotContext = null;

installPrettyConsole();

try {
  startWebServer({
    port: WEB_PORT,
    host: WEB_HOST,
    getBotContext: () => latestBotContext
  });
  logSuccess(`Panel web iniciado en http://localhost:${WEB_PORT}`);
} catch (error) {
  logError("Error iniciando la web local.", error);
}

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  logSuccess("Carpeta cache creada.");
}

function clearCacheFolder() {
  try {
    if (!fs.existsSync(CACHE_DIR)) return;

    const files = fs.readdirSync(CACHE_DIR);
    let deleted = 0;

    for (const file of files) {
      const fullPath = path.join(CACHE_DIR, file);

      try {
        const stat = fs.statSync(fullPath);

        if (stat.isFile()) {
          fs.unlinkSync(fullPath);
          deleted++;
        }
      } catch (err) {
        logWarn(`No se pudo borrar ${file}: ${err.message}`);
      }
    }

    logInfo(`Cache limpiada. Archivos borrados: ${deleted}`);
  } catch (error) {
    logError("Error limpiando cache.", error);
  }
}

setInterval(() => {
  clearCacheFolder();
}, 60 * 1000);

async function buildExecutionContext(base) {
  base.client.commands = await loadPlugins();
  latestBotContext = {
    client: base.client,
    MessageMedia: base.MessageMedia,
    config,
    fs,
    path,
    cacheDir: CACHE_DIR
  };
  patchBotState({
    status: "starting",
    provider: config.provider,
    commands: base.client.commands.size,
    authPath: base.authPath,
    ownerName: config.ownerName,
    botName: config.botName
  });
  return base;
}

async function handleCommand(message, client, shared) {
  try {
    if (!message?.body) return;

    logInfo(
      `Mensaje | from=${formatId(message.from)} | fromMe=${message.fromMe} | body=${message.body}`
    );

    if (!message.body.startsWith(config.prefix)) return;

    const args = message.body
      .slice(config.prefix.length)
      .trim()
      .split(/\s+/);

    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;

    const command = client.commands.get(commandName);

    if (!command) {
      logWarn(`Comando no encontrado: ${commandName}`);
      return;
    }

    logStep(`Ejecutando comando: ${commandName}`);

    await command.execute({
      client,
      message,
      args,
      config,
      MessageMedia: shared.MessageMedia,
      fs,
      path,
      cacheDir: CACHE_DIR,
      runtime: shared.runtime,
      authPath: shared.authPath,
      disableSandbox: shared.disableSandbox,
      reloadCommands: async () => {
        client.commands = await loadPlugins();
        return client.commands.size;
      },
      reply: (content, options) => message.reply(content, undefined, options)
    });
  } catch (error) {
    logError("Error ejecutando comando.", error);
    try {
      await message.reply("Ocurrio un error al ejecutar ese comando.");
    } catch {}
  }
}

function logStartup(shared, commandsSize) {
  patchBotState({
    status: "starting",
    provider: config.provider,
    commands: commandsSize,
    authPath: shared.authPath,
    ownerName: config.ownerName,
    botName: config.botName
  });

  logBanner([
    `${config.botName} iniciado`,
    `${shared.runtime.platform}/${shared.runtime.arch} | Node ${shared.runtime.node}`,
    `Comandos: ${commandsSize} | Auth: ${shared.authPath}`,
    `Provider: ${config.provider}`
  ]);

  for (const hint of getStartupHints(shared.runtime, config)) {
    logWarn(hint);
  }
}

async function startLegacyBot() {
  const shared = await buildExecutionContext(createLegacyClient());
  const { client } = shared;

  logStartup(shared, client.commands.size);
  logInfo(`Chromium sandbox: ${shared.disableSandbox ? "off" : "on"}`);

  client.on("qr", (qr) => {
    if (config.loginMethod?.toLowerCase() !== "qr") return;
    logStep("Escanea este QR con WhatsApp.");
    qrcode.generate(qr, { small: true });
  });

  client.on("code", (code) => {
    logInfo(`Codigo de emparejamiento recibido: ${code}`);
  });

  client.on("loading_screen", (percent, message) => {
    logStep(`Cargando... ${percent}% - ${message}`);
  });

  client.on("authenticated", () => {
    patchBotState({ status: "authenticated" });
    logSuccess("Autenticado correctamente.");
  });

  client.on("ready", () => {
    patchBotState({ status: "ready" });
    logSuccess(`${config.botName} esta listo.`);
    logInfo(`Prefijo: ${config.prefix} | Owner: ${config.ownerName} | Provider: ${config.provider}`);
  });

  client.on("auth_failure", (msg) => {
    patchBotState({ status: "auth_failure" });
    logError(`Fallo la autenticacion: ${msg}`);
  });

  client.on("disconnected", (reason) => {
    patchBotState({ status: "disconnected" });
    logWarn(`Bot desconectado: ${reason}`);
  });

  client.on("message", async (message) => {
    if (!message.fromMe) {
      await handleCommand(message, client, shared);
    }
  });

  client.on("message_create", async (message) => {
    if (message.fromMe) {
      await handleCommand(message, client, shared);
    }
  });

  client.initialize();

  if (config.loginMethod?.toLowerCase() === "code") {
    const rawPhone = config.phoneNumber || process.env.PHONE_NUMBER || "";
    const phone = (rawPhone.match(/\d+/g) || []).join("");

    if (!phone) {
      logWarn("Se selecciono el modo code pero no se proporciono PHONE_NUMBER. Se usara QR.");
    } else {
      try {
        logStep(`Solicitando codigo de emparejamiento para ${phone}...`);
        const pairingCode = await client.requestPairingCode(phone);
        logInfo(`Codigo de emparejamiento: ${pairingCode}`);
      } catch (err) {
        logError("Error generando codigo de emparejamiento.", err);
      }
    }
  }
}

let isRestartingBaileys = false;

async function startBaileysBot() {
  const shared = await buildExecutionContext(await createBaileysRuntime());
  const { sock, client } = shared;

  logStartup(shared, client.commands.size);

  await bindBaileysEvents({
    sock,
    client,
    handleCommand: async (message, currentClient) => {
      await handleCommand(message, currentClient, shared);
    },
    onReconnect: async () => {
      if (isRestartingBaileys) return;
      isRestartingBaileys = true;

      try {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await startBaileysBot();
      } catch (error) {
        logError("Error reconectando Baileys.", error);
      } finally {
        isRestartingBaileys = false;
      }
    }
  });

  await maybeRequestPairingCode(sock, shared.isRegistered);
}

async function startBot() {
  try {
    if ((config.provider || "").toLowerCase() === "whatsapp-web.js") {
      await startLegacyBot();
      return;
    }

    await startBaileysBot();
  } catch (error) {
    logError("Error iniciando el bot.", error);
  }
}

startBot();
