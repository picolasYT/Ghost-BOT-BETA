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

function collectUrls(obj, urls = []) {
  if (!obj) return urls

  if (typeof obj === "string" && obj.startsWith("http")) {
    urls.push(obj)
  }

  if (Array.isArray(obj)) {
    for (const item of obj) collectUrls(item, urls)
  }

  if (typeof obj === "object") {
    for (const value of Object.values(obj)) collectUrls(value, urls)
  }

  return urls
}

export default {
  name: "instagram",
  aliases: ["ig", "igdl"],
  category: "download",
  description: "Descarga reels o posts de Instagram.",

  async execute({ message, args, config, MessageMedia }) {
    try {
      const prefix = config.prefix || "!"
      const url = args[0]

      if (!url || !url.includes("instagram")) {
        return await message.reply(`📸 Usá:\n${prefix}instagram link_de_instagram`)
      }

      await message.reply("⏳ Buscando media de Instagram...")

      const endpoints = [
        `https://api.agatz.xyz/api/igdl?url=${encodeURIComponent(url)}`,
        `https://api.agatz.xyz/api/instagram?url=${encodeURIComponent(url)}`
      ]

      let mediaUrls = []

      for (const endpoint of endpoints) {
        try {
          const json = await fetchJson(endpoint)
          mediaUrls = collectUrls(json)
            .filter(link =>
              link.includes(".mp4") ||
              link.includes(".jpg") ||
              link.includes(".jpeg") ||
              link.includes(".png") ||
              link.includes("cdninstagram")
            )

          if (mediaUrls.length) break
        } catch {}
      }

      mediaUrls = [...new Set(mediaUrls)].slice(0, 3)

      if (!mediaUrls.length) {
        return await message.reply("❌ No pude obtener el contenido de Instagram.")
      }

      for (const mediaUrl of mediaUrls) {
        const media = await MessageMedia.fromUrl(mediaUrl, {
          unsafeMime: true
        })

        await message.reply(media, undefined, {
          caption: "📸 Instagram"
        })
      }
    } catch (e) {
      console.error("❌ Error en instagram.js:", e)
      await message.reply(`❌ Error descargando Instagram.\n\n${e.message}`)
    }
  }
}