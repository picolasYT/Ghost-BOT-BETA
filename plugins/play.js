import yts from "yt-search";

function cleanYoutubeUrl(url) {
  try {
    const u = new URL(url);
    const id = u.searchParams.get("v");
    return id ? `https://www.youtube.com/watch?v=${id}` : url;
  } catch {
    return url;
  }
}

function formatViews(views) {
  if (typeof views !== "number" || views < 0) return "0";
  if (views >= 1e9) return (views / 1e9).toFixed(1) + "B";
  if (views >= 1e6) return (views / 1e6).toFixed(1) + "M";
  if (views >= 1e3) return (views / 1e3).toFixed(1) + "K";
  return views.toString();
}

function limitText(text, max = 900) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "..." : text;
}

export default {
  name: "play",
  description: "Busca una canción o video en YouTube",
  async execute({ message }) {
    const body = message.body || "";
    const args = body.trim().split(/\s+/).slice(1);
    const text = args.join(" ").trim();

    if (!text) {
      return message.reply("🎧 Usá: !play nombre de canción o video");
    }

    try {
      const res = await yts(text);

      if (!res?.videos?.length) {
        return message.reply("❌ No encontré resultados en YouTube.");
      }

      const v = res.videos[0];
      const videoUrl = cleanYoutubeUrl(v.url);
      const title = v.title || "Desconocido";
      const channel = v.author?.name || "Desconocido";
      const duration = v.timestamp || "N/D";
      const views = formatViews(v.views || 0);
      const uploaded = v.ago || "Desconocido";
      const thumbnail = v.thumbnail;

      const caption = limitText(
        `╭━━━ 🎶 *GHOST PLAY* 🎶 ━━━╮\n` +
        `│\n` +
        `│ 🎵 *Título:* ${title}\n` +
        `│ 👤 *Canal:* ${channel}\n` +
        `│ ⏱ *Duración:* ${duration}\n` +
        `│ 👁 *Vistas:* ${views}\n` +
        `│ 📅 *Subido:* ${uploaded}\n` +
        `│\n` +
        `│ 🔗 *Link:* ${videoUrl}\n` +
        `│\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
        `💡 Escribí *!play2 ${text}* para ver más resultados.`
      );

      if (thumbnail) {
        await message.reply(
          thumbnail,
          undefined,
          {
            caption
          }
        );
      } else {
        await message.reply(caption);
      }
    } catch (error) {
      console.error("❌ Error en play.js:", error);
      await message.reply("❌ Ocurrió un error al buscar el video.");
    }
  }
};