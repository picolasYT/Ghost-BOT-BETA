async function getYts() {
  const mod = await import("yt-search")
  return mod.default || mod
}

function formatViews(views = 0) {
  if (views >= 1e9) return `${(views / 1e9).toFixed(1)}B`
  if (views >= 1e6) return `${(views / 1e6).toFixed(1)}M`
  if (views >= 1e3) return `${(views / 1e3).toFixed(1)}K`
  return String(views)
}

export default {
  name: "play",
  aliases: ["ytplay"],
  category: "search",
  description: "Busca música o videos en YouTube.",

  async execute({ message, args, config }) {
    try {
      const prefix = config.prefix || "!"
      const text = args.join(" ").trim()

      if (!text) {
        return await message.reply(`🎧 Usá:\n${prefix}play nombre de la canción`)
      }

      const yts = await getYts()
      const res = await yts(text)

      if (!res?.videos?.length) {
        return await message.reply("❌ No encontré resultados.")
      }

      const v = res.videos[0]

      const msg =
        `🎶 *GHOST PLAY*\n\n` +
        `🎵 *Título:* ${v.title}\n` +
        `👤 *Canal:* ${v.author?.name || "Desconocido"}\n` +
        `⏱️ *Duración:* ${v.timestamp || "N/D"}\n` +
        `👁️ *Vistas:* ${formatViews(v.views || 0)}\n` +
        `📅 *Subido:* ${v.ago || "N/D"}\n\n` +
        `🔗 ${v.url}\n\n` +
        `💡 Para audio:\n${prefix}ytmp3 ${v.url}\n\n` +
        `💡 Para video:\n${prefix}ytmp4 ${v.url}`

      await message.reply(msg)
    } catch (e) {
      console.error("❌ Error en play.js:", e)
      await message.reply(`❌ Error buscando en YouTube.\n\n${e.message}`)
    }
  }
}