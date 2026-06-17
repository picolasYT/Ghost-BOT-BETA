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
  name: "facebook",
  aliases: ["fb", "fbdl"],
  category: "download",
  description: "Descarga videos de Facebook.",

  async execute({ message, args, config, MessageMedia }) {
    try {
      const prefix = config.prefix || "!"
      const url = args[0]

      if (!url || !(url.includes("facebook") || url.includes("fb.watch"))) {
        return await message.reply(`📘 Usá:\n${prefix}facebook link_de_facebook`)
      }

      await message.reply("⏳ Buscando video de Facebook...")

      const endpoints = [
        `https://api.agatz.xyz/api/facebook?url=${encodeURIComponent(url)}`,
        `https://api.agatz.xyz/api/fbdl?url=${encodeURIComponent(url)}`
      ]

      let mediaUrls = []

      for (const endpoint of endpoints) {
        try {
          const json = await fetchJson(endpoint)
          mediaUrls = collectUrls(json)
            .filter(link => link.includes(".mp4") || link.includes("fbcdn"))

          if (mediaUrls.length) break
        } catch {}
      }

      mediaUrls = [...new Set(mediaUrls)].slice(0, 1)

      if (!mediaUrls.length) {
        return await message.reply("❌ No pude obtener el video de Facebook.")
      }

      const media = await MessageMedia.fromUrl(mediaUrls[0], {
        unsafeMime: true
      })

      await message.reply(media, undefined, {
        caption: "📘 Facebook"
      })
    } catch (e) {
      console.error("❌ Error en facebook.js:", e)
      await message.reply(`❌ Error descargando Facebook.\n\n${e.message}`)
    }
  }
}