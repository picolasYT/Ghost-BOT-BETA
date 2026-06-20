const subbots = global.subbots || (global.subbots = new Map())

function cleanPhone(text = "") {
  return text.replace(/\D/g, "")
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function loadWhatsappWeb() {
  const mod = await import("whatsapp-web.js")
  return mod.default || mod
}

function getSubbotClientId(phone) {
  return `ghost-subbot-${phone}`
}

async function startCommandHandler({ subClient, mainClient, config, MessageMedia, fs, path, cacheDir }) {
  subClient.commands = mainClient.commands

  async function handleCommand(message) {
    try {
      if (!message?.body) return
      if (!message.body.startsWith(config.prefix)) return

      const args = message.body
        .slice(config.prefix.length)
        .trim()
        .split(/\s+/)

      const commandName = args.shift()?.toLowerCase()
      if (!commandName) return

      const command = subClient.commands.get(commandName)
      if (!command) return

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
      })
    } catch (e) {
      console.error("❌ Error en subbot:", e)
      try {
        await message.reply("❌ Error ejecutando comando en subbot.")
      } catch {}
    }
  }

  subClient.on("message", async message => {
    if (!message.fromMe) await handleCommand(message)
  })

  subClient.on("message_create", async message => {
    if (message.fromMe) await handleCommand(message)
  })
}

export default {
  name: "code",
  aliases: ["subbot", "serbot"],
  category: "subbots",
  description: "Genera código para convertir un número en subbot.",

  async execute({ client, message, args, config, MessageMedia, fs, path, cacheDir }) {
    try {
      const prefix = config.prefix || "!"

      if (message.from.endsWith("@g.us")) {
        return await message.reply(
          `⚠️ Por seguridad usá este comando en privado.\n\nEjemplo:\n${prefix}code 549112345678`
        )
      }

      const action = args[0]?.toLowerCase()

      if (action === "stop") {
        const phone = cleanPhone(args[1] || "")

        if (!phone) {
          return await message.reply(`⚠️ Usá:\n${prefix}code stop 549112345678`)
        }

        const sub = subbots.get(phone)

        if (!sub) {
          return await message.reply("❌ No encontré un subbot activo con ese número.")
        }

        await sub.destroy()
        subbots.delete(phone)

        return await message.reply("✅ Subbot apagado correctamente.")
      }

      const phone = cleanPhone(args.join(" "))

      if (!phone || phone.length < 8) {
        return await message.reply(
          `📲 *Convertirse en subbot*\n\nUsá:\n${prefix}code 549112345678\n\nEl número debe ir con código de país y sin +, espacios ni guiones.`
        )
      }

      if (subbots.has(phone)) {
        return await message.reply("⚠️ Ese número ya tiene un subbot iniciado.")
      }

      const { Client, LocalAuth } = await loadWhatsappWeb()
      const clientId = getSubbotClientId(phone)

      const subClient = new Client({
        authStrategy: new LocalAuth({
          clientId,
          dataPath: config.authPath || "./data/auth"
        }),
        puppeteer: {
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage"
          ]
        }
      })

      subClient.isSubbot = true
      subClient.mainClientRef = client
      subClient.subbotMeta = {
        phone,
        clientId,
        ownerChat: message.from,
        authPath: config.authPath || "./data/auth"
      }

      subbots.set(phone, subClient)

      await startCommandHandler({
        subClient,
        mainClient: client,
        config,
        MessageMedia,
        fs,
        path,
        cacheDir
      })

      subClient.on("authenticated", async () => {
        await client.sendMessage(message.from, "✅ Subbot autenticado correctamente.")
      })

      subClient.on("ready", async () => {
        await client.sendMessage(message.from, "👻 Subbot conectado y listo para usar comandos.")
      })

      subClient.on("disconnected", async reason => {
        subbots.delete(phone)
        await client.sendMessage(message.from, `⚠️ Subbot desconectado: ${reason}`)
      })

      subClient.initialize()

      await message.reply("⏳ Iniciando subbot, esperá unos segundos...")

      await wait(7000)

      if (typeof subClient.requestPairingCode !== "function") {
        return await message.reply(
          "❌ Tu versión de whatsapp-web.js no soporta código de emparejamiento.\nActualizá con:\nnpm i whatsapp-web.js@latest"
        )
      }

      const pairingCode = await subClient.requestPairingCode(phone)

      await message.reply(
        `🔐 *Código de emparejamiento:*\n\n*${pairingCode}*\n\n📲 En WhatsApp entrá a:\nDispositivos vinculados > Vincular con número de teléfono\n\n⏱️ El código puede vencer rápido.`
      )
    } catch (e) {
      console.error("❌ Error en code.js:", e)

      await message.reply(
        `❌ Error creando subbot.\n\nError: ${e.message}`
      )
    }
  }
}
