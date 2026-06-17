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
  name: "play2",
  aliases: ["ytsearch"],
  category: "search",
  description: "Muestra varios resultados de YouTube.",

  async execute({ message, args, config }) {
    try {
      const prefix = config.prefix || "!"
      const text = args.join(" ").trim()

      if (!text) {
        return await message.reply(`🎧 Usá:\n${prefix}play2 nombre de canción o video`)
      }

      const yts = await getYts()
      const res = await yts(text)

      if (!res?.videos?.length) {
        return await message.reply("❌ No encontré resultados.")
      }

      const results = res.videos.slice(0, 5)

      const msg =
        `🔎 *Resultados para:* ${text}\n\n` +
        results.map((v, i) => {
          return (
            `*${i + 1}.* ${v.title}\n` +
            `👤 ${v.author?.name || "Desconocido"}\n` +
            `⏱️ ${v.timestamp || "N/D"} | 👁️ ${formatViews(v.views || 0)}\n` +
            `🔗 ${v.url}`
          )
        }).join("\n\n")

      await message.reply(msg)
    } catch (e) {
      console.error("❌ Error en play2.js:", e)
      await message.reply(`❌ Error buscando resultados.\n\n${e.message}`)
    }
  }
}