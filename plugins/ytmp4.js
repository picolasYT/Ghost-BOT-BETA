async function getYtdl() {
  try {
    const mod = await import("@distube/ytdl-core")
    return mod.default || mod
  } catch {
    const mod = await import("ytdl-core")
    return mod.default || mod
  }
}

async function getYts() {
  const mod = await import("yt-search")
  return mod.default || mod
}

function safeName(text = "video") {
  return text.replace(/[\\/:*?"<>|]/g, "").slice(0, 60) || "video"
}

function streamToBuffer(stream, limit = 55 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0

    stream.on("data", chunk => {
      size += chunk.length

      if (size > limit) {
        stream.destroy()
        reject(new Error("El video es demasiado pesado para WhatsApp."))
        return
      }

      chunks.push(chunk)
    })

    stream.on("end", () => resolve(Buffer.concat(chunks)))
    stream.on("error", reject)
  })
}

async function resolveYoutube(text, ytdl) {
  if (ytdl.validateURL(text)) return text

  const yts = await getYts()
  const res = await yts(text)

  if (!res?.videos?.length) return null

  return res.videos[0].url
}

export default {
  name: "ytmp4",
  aliases: ["ytvideo", "ytv"],
  category: "download",
  description: "Descarga video de YouTube.",

  async execute({ message, args, config, MessageMedia }) {
    try {
      const prefix = config.prefix || "!"
      const text = args.join(" ").trim()

      if (!text) {
        return await message.reply(`🎬 Usá:\n${prefix}ytmp4 link o nombre de video`)
      }

      const ytdl = await getYtdl()
      const url = await resolveYoutube(text, ytdl)

      if (!url) {
        return await message.reply("❌ No encontré ese video.")
      }

      const info = await ytdl.getInfo(url)
      const title = info.videoDetails?.title || "video"

      if (Number(info.videoDetails?.lengthSeconds || 0) > 600) {
        return await message.reply("❌ El video es muy largo. Máximo recomendado: 10 minutos.")
      }

      await message.reply("⏳ Descargando video...")

      const format = ytdl.chooseFormat(info.formats, {
        quality: "highest",
        filter: format => format.hasAudio && format.hasVideo && format.container === "mp4"
      })

      const stream = ytdl.downloadFromInfo(info, {
        format
      })

      const buffer = await streamToBuffer(stream)

      const media = new MessageMedia(
        "video/mp4",
        buffer.toString("base64"),
        `${safeName(title)}.mp4`
      )

      await message.reply(media, undefined, {
        caption: `🎬 ${title}`
      })
    } catch (e) {
      console.error("❌ Error en ytmp4.js:", e)
      await message.reply(`❌ Error descargando video.\n\n${e.message}`)
    }
  }
}