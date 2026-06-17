import "dotenv/config";
import fs from "fs";
import path from "path";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import config from "./config.js";
import { loadPlugins } from "./utils/loadPlugins.js";

const { Client, LocalAuth, MessageMedia } = pkg;

const CACHE_DIR = path.resolve("./cache");

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log("📁 Carpeta cache creada.");
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
        console.log(`⚠️ No se pudo borrar ${file}: ${err.message}`);
      }
    }

    console.log(`🧹 Cache limpiada. Archivos borrados: ${deleted}`);
  } catch (error) {
    console.log("❌ Error limpiando cache:", error.message);
  }
}

setInterval(() => {
  clearCacheFolder();
}, 60 * 1000);

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "ghost-bot"
  }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  }
});

client.commands = new Map();

async function handleCommand(message) {
  try {
    if (!message?.body) return;

    console.log(
      `📩 Mensaje detectado | from: ${message.from} | fromMe: ${message.fromMe} | body: ${message.body}`
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
      console.log(`⚠️ Comando no encontrado: ${commandName}`);
      return;
    }

    console.log(`⚡ Ejecutando comando: ${commandName}`);

    await command.execute({
  client,
  message,
  args,
  config,
  MessageMedia,
  fs,
  path,
  cacheDir: CACHE_DIR,
  reply: (content, options) => message.reply(content, undefined, options)
});
  } catch (error) {
    console.error("❌ Error ejecutando comando:", error);
    try {
      await message.reply("❌ Ocurrió un error al ejecutar ese comando.");
    } catch {}
  }
}

async function startBot() {
  try {
    client.commands = await loadPlugins();

    console.log(`📦 Plugins cargados: ${client.commands.size}`);

    // Evento QR: se dispara cuando es necesaria la autenticación por código QR.
    // Este evento seguirá disponible aunque se utilice el método de emparejamiento
    // por código. Mostramos el código solo si el modo de autenticación es QR.
    client.on("qr", (qr) => {
      if (config.loginMethod?.toLowerCase() !== "qr") return;
      console.log("\n📱 ESCANEÁ ESTE QR CON WHATSAPP:\n");
      qrcode.generate(qr, { small: true });
    });

    // Evento code: se dispara cuando se recibe un código de emparejamiento.
    // Mostramos el código por consola para que el usuario pueda introducirlo
    // en su aplicación móvil.
    client.on("code", (code) => {
      console.log("\n📟 Código de emparejamiento recibido:\n");
      console.log(`🔢 ${code}\n`);
    });

    client.on("loading_screen", (percent, message) => {
      console.log(`⏳ Cargando... ${percent}% - ${message}`);
    });

    client.on("authenticated", () => {
      console.log("✅ Autenticado correctamente.");
    });

    client.on("ready", () => {
      console.log(`🤖 ${config.botName} está listo.`);
      console.log(`📌 Prefijo: ${config.prefix}`);
      console.log(`👑 Owner: ${config.ownerName}`);
    });

    client.on("auth_failure", (msg) => {
      console.log("❌ Falló la autenticación:", msg);
    });

    client.on("disconnected", (reason) => {
      console.log("⚠️ Bot desconectado:", reason);
    });

    // Mensajes recibidos de otros
    client.on("message", async (message) => {
      if (!message.fromMe) {
        await handleCommand(message);
      }
    });

    // Mensajes creados, incluyendo los tuyos
    client.on("message_create", async (message) => {
      if (message.fromMe) {
        await handleCommand(message);
      }
    });

    client.initialize();

    // Si se configuró el método de autenticación por código y se proporcionó
    // un número de teléfono válido, solicitamos el código de emparejamiento.
    if (config.loginMethod?.toLowerCase() === "code") {
      // Normalizamos el número eliminando caracteres no numéricos
      const rawPhone = config.phoneNumber || process.env.PHONE_NUMBER || "";
      const phone = (rawPhone.match(/\d+/g) || []).join("");
      if (!phone) {
        console.log("⚠️ Se seleccionó el modo de emparejamiento por código pero no se proporcionó PHONE_NUMBER. Usando QR por defecto.");
      } else {
        try {
          console.log(`\n📲 Solicitando código de emparejamiento para el número ${phone}...`);
          const pairingCode = await client.requestPairingCode(phone);
          // requestPairingCode devuelve el código una vez, pero también será
          // emitido por el evento "code". Mostramos por si acaso.
          console.log(`\n📟 Código de emparejamiento: ${pairingCode}\n`);
        } catch (err) {
          console.error("❌ Error generando código de emparejamiento:", err);
        }
      }
    }
  } catch (error) {
    console.error("❌ Error iniciando el bot:", error);
  }
}

startBot();