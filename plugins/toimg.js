export default {
  name: "toimg",
  aliases: ["stickerimg", "stickerimage"],
  category: "media",
  description: "Convierte sticker en imagen PNG.",

  async execute({ message, MessageMedia }) {
    try {
      if (!message.hasQuotedMsg) {
        return await message.reply("⚠️ Respondé a un sticker con el comando.")
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
      const output = await sharp(input).png().toBuffer()

      const img = new MessageMedia(
        "image/png",
        output.toString("base64"),
        "sticker.png"
      )

      await message.reply(img)
    } catch (e) {
      console.error("❌ Error en toimg.js:", e)
      await message.reply(`❌ Error convirtiendo sticker a imagen.\n\n${e.message}`)
    }
  }
}