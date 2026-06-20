import { formatViews, getYoutubeMetadata, getYtdl } from "../utils/youtube.js";

export default {
  name: "play",
  aliases: ["ytplay"],
  category: "search",
  description: "Busca musica o videos en YouTube.",

  async execute({ message, args, config }) {
    try {
      const prefix = config.prefix || "!";
      const text = args.join(" ").trim();

      if (!text) {
        return await message.reply(`Usa:\n${prefix}play nombre de la cancion`);
      }

      const ytdl = await getYtdl();
      const v = await getYoutubeMetadata(text, ytdl);

      if (!v) {
        return await message.reply("No encontre resultados.");
      }

      const msg =
        `*GHOST PLAY*\n\n` +
        `Titulo: ${v.title}\n` +
        `Canal: ${v.author?.name || "Desconocido"}\n` +
        `Duracion: ${v.timestamp || "N/D"}\n` +
        `Vistas: ${formatViews(v.views || 0)}\n` +
        `Subido: ${v.ago || "N/D"}\n\n` +
        `${v.url}\n\n` +
        `Audio:\n${prefix}ytmp3 ${v.url}\n\n` +
        `Video:\n${prefix}ytmp4 ${v.url}`;

      await message.reply(msg);
    } catch (e) {
      console.error("Error en play.js:", e);
      await message.reply(`Error buscando en YouTube.\n\n${e.message}`);
    }
  }
}
