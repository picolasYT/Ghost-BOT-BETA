import { formatViews, searchYoutube } from "../utils/youtube.js";

export default {
  name: "play2",
  aliases: ["ytsearch"],
  category: "search",
  description: "Muestra varios resultados de YouTube.",

  async execute({ message, args, config }) {
    try {
      const prefix = config.prefix || "!";
      const text = args.join(" ").trim();

      if (!text) {
        return await message.reply(`Usa:\n${prefix}play2 nombre de cancion o video`);
      }

      const res = await searchYoutube(text);

      if (!res?.videos?.length) {
        return await message.reply("No encontre resultados.");
      }

      const results = res.videos.slice(0, 5);

      const msg =
        `*Resultados para:* ${text}\n\n` +
        results
          .map((v, i) => {
            return (
              `*${i + 1}.* ${v.title}\n` +
              `${v.author?.name || "Desconocido"}\n` +
              `${v.timestamp || "N/D"} | ${formatViews(v.views || 0)} vistas\n` +
              `${v.url}\n` +
              `Audio: ${prefix}ytmp3 ${v.url}\n` +
              `Video: ${prefix}ytmp4 ${v.url}`
            );
          })
          .join("\n\n");

      await message.reply(msg);
    } catch (e) {
      console.error("Error en play2.js:", e);
      await message.reply(`Error buscando resultados.\n\n${e.message}`);
    }
  }
}
