import "dotenv/config";
import fs from "fs";
import path from "path";
import qrcode from "qrcode-terminal";
import config from "./config.js";
import { loadPlugins } from "./utils/loadPlugins.js";
import { createClient } from "./utils/createClient.js";
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

const CACHE_DIR = path.resolve("./cache");

installPrettyConsole();

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

const { client, runtime, authPath, disableSandbox, MessageMedia } = createClient();

async function reloadCommands() {
  client.commands = await loadPlugins();
  return client.commands.size;
}

async function handleCommand(message) {
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
      MessageMedia,
      fs,
      path,
      cacheDir: CACHE_DIR,
      runtime,
      authPath,
      disableSandbox,
      reloadCommands,
      reply: (content, options) => message.reply(content, undefined, options)
    });
  } catch (error) {
    logError("Error ejecutando comando.", error);
    try {
      await message.reply("Ocurrio un error al ejecutar ese comando.");
    } catch {}
  }
}

async function startBot() {
  try {
    await reloadCommands();

    logBanner([
      `${config.botName} iniciado`,
      `${runtime.platform}/${runtime.arch} | Node ${runtime.node}`,
      `Comandos: ${client.commands.size} | Auth: ${authPath}`,
      `Chromium sandbox: ${disableSandbox ? "off" : "on"}`
    ]);

    for (const hint of getStartupHints(runtime, config)) {
      logWarn(hint);
    }

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
      logSuccess("Autenticado correctamente.");
    });

    client.on("ready", () => {
      logSuccess(`${config.botName} esta listo.`);
      logInfo(`Prefijo: ${config.prefix} | Owner: ${config.ownerName} | Provider: ${config.provider}`);
    });

    client.on("auth_failure", (msg) => {
      logError(`Fallo la autenticacion: ${msg}`);
    });

    client.on("disconnected", (reason) => {
      logWarn(`Bot desconectado: ${reason}`);
    });

    client.on("message", async (message) => {
      if (!message.fromMe) {
        await handleCommand(message);
      }
    });

    client.on("message_create", async (message) => {
      if (message.fromMe) {
        await handleCommand(message);
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
  } catch (error) {
    logError("Error iniciando el bot.", error);
  }
}

startBot();
