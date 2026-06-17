export default {
  name: "togif",
  aliases: ["stickergif"],
  category: "media",
  description: "Convierte sticker animado en GIF.",

  async execute({ message, MessageMedia }) {
    try {
      if (!message.hasQuotedMsg) {
        return await message.reply("⚠️ Respondé a un sticker animado con el comando.")
      }

      const quoted = await message.getQuotedMessage()

      if (!quoted.hasMedia) {
        return await message.reply("❌ El mensaje citado no tiene media.")
      }

      const media = await quoted.downloadMedia()

      if (!media || !media.mimetype.includes("webp")) {
        return await message.reply("❌ Eso no parece ser un sticker.")
      }

      const sharpMod = await import("sharp")
      const sharp = sharpMod.default || sharpMod

      const input = Buffer.from(media.data, "base64")
      const output = await sharp(input, { animated: true }).gif().toBuffer()

      const gif = new MessageMedia(
        "image/gif",
        output.toString("base64"),
        "sticker.gif"
      )

      await message.reply(gif, undefined, {
        sendVideoAsGif: true
      })
    } catch (e) {
      console.error("❌ Error en togif.js:", e)
      await message.reply(`❌ Error convirtiendo sticker a GIF.\n\n${e.message}`)
    }
  }
}