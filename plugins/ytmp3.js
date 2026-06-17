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

function safeName(text = "audio") {
  return text.replace(/[\\/:*?"<>|]/g, "").slice(0, 60) || "audio"
}

function streamToBuffer(stream, limit = 45 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0

    stream.on("data", chunk => {
      size += chunk.length

      if (size > limit) {
        stream.destroy()
        reject(new Error("El archivo es demasiado pesado para enviarlo por WhatsApp."))
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
  name: "ytmp3",
  aliases: ["ytaudio", "yta"],
  category: "download",
  description: "Descarga audio de YouTube.",

  async execute({ message, args, config, MessageMedia }) {
    try {
      const prefix = config.prefix || "!"
      const text = args.join(" ").trim()

      if (!text) {
        return await message.reply(`🎧 Usá:\n${prefix}ytmp3 link o nombre de canción`)
      }

      const ytdl = await getYtdl()
      const url = await resolveYoutube(text, ytdl)

      if (!url) {
        return await message.reply("❌ No encontré ese video.")
      }

      const info = await ytdl.getInfo(url)
      const title = info.videoDetails?.title || "audio"

      if (Number(info.videoDetails?.lengthSeconds || 0) > 900) {
        return await message.reply("❌ El audio es muy largo. Máximo recomendado: 15 minutos.")
      }

      await message.reply("⏳ Descargando audio...")

      const stream = ytdl.downloadFromInfo(info, {
        filter: "audioonly",
        quality: "highestaudio"
      })

      const buffer = await streamToBuffer(stream)

      const media = new MessageMedia(
        "audio/mp4",
        buffer.toString("base64"),
        `${safeName(title)}.mp3`
      )

      await message.reply(media, undefined, {
        sendAudioAsVoice: false
      })
    } catch (e) {
      console.error("❌ Error en ytmp3.js:", e)
      await message.reply(`❌ Error descargando audio.\n\n${e.message}`)
    }
  }
}