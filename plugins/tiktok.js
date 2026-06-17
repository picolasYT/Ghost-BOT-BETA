async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0"
    }
  })

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`)
  }

  return await res.json()
}

export default {
  name: "tiktok",
  aliases: ["tt", "ttdl"],
  category: "download",
  description: "Descarga videos de TikTok.",

  async execute({ message, args, config, MessageMedia }) {
    try {
      const prefix = config.prefix || "!"
      const url = args[0]

      if (!url || !url.includes("tiktok")) {
        return await message.reply(`🎵 Usá:\n${prefix}tiktok link_de_tiktok`)
      }

      await message.reply("⏳ Descargando TikTok...")

      const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`
      const json = await fetchJson(api)

      const data = json.data || {}
      const videoUrl = data.play || data.wmplay || data.hdplay

      if (!videoUrl) {
        return await message.reply("❌ No pude obtener el video.")
      }

      const media = await MessageMedia.fromUrl(videoUrl, {
        unsafeMime: true
      })

      await message.reply(media, undefined, {
        caption: `🎵 *TikTok*\n\n${data.title || ""}`
      })
    } catch (e) {
      console.error("❌ Error en tiktok.js:", e)
      await message.reply(`❌ Error descargando TikTok.\n\n${e.message}`)
    }
  }
}