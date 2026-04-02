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

export default {
  name: "play2",
  description: "Muestra varios resultados de YouTube",
  async execute({ message }) {
    const body = message.body || "";
    const args = body.trim().split(/\s+/).slice(1);
    const text = args.join(" ").trim();

    if (!text) {
      return message.reply("🎧 Usá: !play2 nombre de canción o video");
    }

    try {
      const res = await yts(text);

      if (!res?.videos?.length) {
        return message.reply("❌ No encontré resultados.");
      }

      const top = res.videos.slice(0, 5);

      const msg =
        `🎶 *Resultados para:* ${text}\n\n` +
        top.map((v, i) => {
          return (
            `*${i + 1}.* ${v.title}\n` +
            `👤 ${v.author?.name || "Desconocido"}\n` +
            `⏱ ${v.timestamp || "N/D"} | 👁 ${formatViews(v.views || 0)}\n` +
            `🔗 ${cleanYoutubeUrl(v.url)}`
          );
        }).join("\n\n");

      await message.reply(msg);
    } catch (error) {
      console.error("❌ Error en play2.js:", error);
      await message.reply("❌ Error buscando resultados.");
    }
  }
};