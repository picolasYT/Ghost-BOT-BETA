import {
  buildMediaFileName,
  buildMediaSummary,
  getQuotedNormalMedia
} from "../utils/mediaTools.js";

export default {
  name: "ver",
  aliases: ["review", "mostrar"],
  category: "media",
  description: "Reenvia una foto, video, audio o documento normal citado.",

  async execute({ message, MessageMedia }) {
    try {
      const { quoted, media } = await getQuotedNormalMedia(message);
      const fileName = buildMediaFileName(media, quoted);
      const resend = new MessageMedia(media.mimetype, media.data, fileName);

      await message.reply(
        `${buildMediaSummary(quoted, media)}\n\nReenviando medio normal...`
      );
      await message.reply(resend);
    } catch (e) {
      console.error("Error en ver.js:", e);
      await message.reply(`Error usando ver.\n\n${e.message}`);
    }
  }
}
