const borders = [
  "👻🌟👻🌟👻🌟",
  "🌐👻🌐🤖👾👽",
  "👾👻🤖🌐👻👽",
  "👨‍🔬🔭⚛️🔬⚗️👩‍🔬",
  "🧪⚗️🔬👨‍🔬👩‍🔬⚛️🔭"
]

const menuImage = "https://files.catbox.moe/i8twyd.png"

function randomBorder() {
  return borders[Math.floor(Math.random() * borders.length)]
}

function formatTime() {
  const now = new Date()

  return now.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  })
}

function formatDate() {
  const now = new Date()

  return now.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  })
}

function formatUptime() {
  const uptimeSec = process.uptime()
  const h = Math.floor(uptimeSec / 3600)
  const m = Math.floor((uptimeSec % 3600) / 60)
  const s = Math.floor(uptimeSec % 60)

  return `${h}h ${m}m ${s}s`
}

function getUniqueCommands(client) {
  const unique = new Map()

  for (const command of client.commands.values()) {
    if (!command?.name) continue
    unique.set(command.name, command)
  }

  return [...unique.values()]
}

function buildCategories(client) {
  const categories = {}

  const commands = getUniqueCommands(client)

  for (const command of commands) {
    const category = command.category || "main"

    if (!categories[category]) {
      categories[category] = []
    }

    categories[category].push(command)
  }

  return categories
}

export default {
  name: "menu",
  aliases: ["menu2", "help", "ayuda", "comandos"],
  category: "main",
  description: "Menú principal del bot.",

  async execute({ client, message, args, config, MessageMedia }) {
    try {
      const prefix = config.prefix || "."
      const botName = config.botName || "Ghost Bot"
      const border = randomBorder()

      const categories = buildCategories(client)
      const selectedCategory = args?.join(" ")?.trim()?.toLowerCase()

      if (selectedCategory) {
        const categoryName = Object.keys(categories).find(
          cat => cat.toLowerCase() === selectedCategory
        )

        if (!categoryName) {
          return await message.reply(
            `❌ Esa categoría no existe.\n\nUsá *${prefix}menu* para ver las categorías disponibles.`
          )
        }

        const comandos = categories[categoryName]
          .map(cmd => {
            const desc = cmd.description || "Sin descripción"
            return `• ${prefix}${cmd.name} - ${desc}`
          })
          .join("\n")

        const text = `${border}
*GHOST BOT*
${border}

📂 *Categoría:* ${categoryName}

📚 *Comandos disponibles:*

${comandos || "No hay comandos en esta categoría."}

${border}`

        return await message.reply(text)
      }

      const categoryList = Object.keys(categories)
        .map(cat => `• *${prefix}menu ${cat}*`)
        .join("\n")

      const totalCommands = getUniqueCommands(client).length

      const text = `${border}
*GHOST BOT*
${border}

👻 *Bot:* ${botName}
👑 *Creador:* Picolas
⏱️ *Uptime:* ${formatUptime()}
🕒 *Hora:* ${formatTime()}
📅 *Fecha:* ${formatDate()}
📚 *Comandos:* ${totalCommands}

${border}

📂 *Categorías disponibles:*

${categoryList || "No hay categorías disponibles."}

${border}

💡 *Ejemplo:*
${prefix}menu main`

      try {
        const media = await MessageMedia.fromUrl(menuImage, {
          unsafeMime: true
        })

        await message.reply(media, undefined, {
          caption: text
        })
      } catch {
        await message.reply(text)
      }

    } catch (e) {
      console.error("❌ Error en menu.js:", e)

      await message.reply(
        `❌ Ocurrió un error al ejecutar el menú.\n\nError: ${e.message}`
      )
    }
  }
}