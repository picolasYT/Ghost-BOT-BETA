export default {
  name: "sticker",
  description: "Convierte una imagen en sticker",
  async execute({ message }) {
    const quoted = await message.getQuotedMessage();

    if (!quoted || !quoted.hasMedia) {
      return message.reply("Respondé a una imagen con !sticker");
    }

    const media = await quoted.downloadMedia();

    if (!media || !media.mimetype.startsWith("image/")) {
      return message.reply("Eso no es una imagen válida.");
    }

    await message.reply(media, undefined, {
      sendMediaAsSticker: true,
      stickerAuthor: "Picolas",
      stickerName: "Ghost-Bot Picolas_YT en tiktok"
    });
  }
};