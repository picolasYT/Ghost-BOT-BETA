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

function formatInitError(error, config) {
  const message = String(error?.message || error || "No se pudo iniciar el subbot.")

  if (message.includes("Could not find Chrome")) {
    const currentPath = config.chromePath || "sin definir"
    return (
      "No se pudo iniciar el subbot porque Chrome/Chromium no esta disponible en este entorno.\n" +
      `CHROME_PATH actual: ${currentPath}\n\n` +
      "En Render tenes que instalar Chrome/Chromium o definir CHROME_PATH a un ejecutable valido."
    )
  }

  return message
}

async function cleanupFailedSubbot(subClient, phone) {
  try {
    await subClient.destroy()
  } catch {}

  subbots.delete(phone)
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
    } catch (error) {
      console.error("Error en subbot:", error)
      try {
        await message.reply("Error ejecutando comando en subbot.")
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
  description: "Genera codigo para convertir un numero en subbot.",

  async execute({ client, message, args, config, MessageMedia, fs, path, cacheDir }) {
    try {
      const prefix = config.prefix || "!"

      if (message.from.endsWith("@g.us")) {
        return await message.reply(
          `Por seguridad usa este comando en privado.\n\nEjemplo:\n${prefix}code 549112345678`
        )
      }

      const action = args[0]?.toLowerCase()

      if (action === "stop") {
        const phone = cleanPhone(args[1] || "")

        if (!phone) {
          return await message.reply(`Usa:\n${prefix}code stop 549112345678`)
        }

        const sub = subbots.get(phone)

        if (!sub) {
          return await message.reply("No encontre un subbot activo con ese numero.")
        }

        await sub.destroy()
        subbots.delete(phone)

        return await message.reply("Subbot apagado correctamente.")
      }

      const phone = cleanPhone(args.join(" "))

      if (!phone || phone.length < 8) {
        return await message.reply(
          `Convertirse en subbot\n\nUsa:\n${prefix}code 549112345678\n\nEl numero debe ir con codigo de pais y sin +, espacios ni guiones.`
        )
      }

      if (subbots.has(phone)) {
        return await message.reply("Ese numero ya tiene un subbot iniciado.")
      }

      const { Client, LocalAuth, MessageMedia: SubbotMessageMedia } = await loadWhatsappWeb()
      const clientId = getSubbotClientId(phone)

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
        MessageMedia: SubbotMessageMedia,
        fs,
        path,
        cacheDir
      })

      subClient.on("authenticated", async () => {
        await client.sendMessage(message.from, "Subbot autenticado correctamente.")
      })

      subClient.on("ready", async () => {
        await client.sendMessage(message.from, "Subbot conectado y listo para usar comandos.")
      })

      subClient.on("disconnected", async reason => {
        subbots.delete(phone)
        try {
          await client.sendMessage(message.from, `Subbot desconectado: ${reason}`)
        } catch {}
      })

      subClient.on("auth_failure", async reason => {
        subbots.delete(phone)
        try {
          await client.sendMessage(
            message.from,
            `Fallo la autenticacion del subbot: ${reason || "sin detalle"}`
          )
        } catch {}
      })

      subClient.on("change_state", state => {
        console.log(`Estado subbot ${phone}: ${state}`)
      })

      let initializeError = null
      const initializePromise = Promise.resolve(subClient.initialize()).catch(error => {
        initializeError = error
        return null
      })

      await message.reply("Iniciando subbot, espera unos segundos...")

      await wait(7000)

      if (initializeError) {
        await cleanupFailedSubbot(subClient, phone)
        throw new Error(formatInitError(initializeError, config))
      }

      if (typeof subClient.requestPairingCode !== "function") {
        await cleanupFailedSubbot(subClient, phone)
        return await message.reply(
          "Tu version de whatsapp-web.js no soporta codigo de emparejamiento.\nActualiza con:\nnpm i whatsapp-web.js@latest"
        )
      }

      const pairingCode = await subClient.requestPairingCode(phone)
      await initializePromise

      await message.reply(
        `Codigo de emparejamiento:\n\n${pairingCode}\n\nEn WhatsApp entra a:\nDispositivos vinculados > Vincular con numero de telefono`
      )
    } catch (error) {
      console.error("Error en code.js:", error)

      await message.reply(
        `Error creando subbot.\n\nError: ${error.message}`
      )
    }
  }
}
