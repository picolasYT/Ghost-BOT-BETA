import {
  MAX_VIDEO_SIZE,
  fetchBuffer,
  fetchThumbnailBuffer,
  formatBytes,
  getFareVideo,
  getRemoteFileSize,
  getYoutubeUrl,
  sanitizeFileName
} from "../utils/fare.js";

export default {
  name: "ytmp4",
  aliases: ["ytvideo", "ytv"],
  category: "download",
  description: "Descarga video de YouTube usando una API externa.",

  async execute({ message, args, config, MessageMedia }) {
    try {
      const prefix = config.prefix || "!";
      const text = args.join(" ").trim();

      if (!text) {
        return await message.reply(`Usa:\n${prefix}ytmp4 link o nombre de video`);
      }

      const url = await getYoutubeUrl(text);
      const data = await getFareVideo(url);

      if (!data?.downloadUrl) {
        return await message.reply("No se pudo descargar el video. Intenta mas tarde.");
      }

      const sizeBytes = data.sizeBytes || (await getRemoteFileSize(data.downloadUrl).catch(() => null));
      const sizeText = sizeBytes ? formatBytes(sizeBytes) : data.sizeText || "Desconocido";

      const infoMessage = [
        `Descargando: *${data.title}*`,
        "",
        `Canal: *${data.channel}*`,
        `Duracion: *${data.duration}*`,
        `Vistas: *${data.views.toLocaleString("es-AR")}*`,
        `Calidad: *${data.quality}*`,
        `Tamano: *${sizeText}*`,
        `Enlace: *${url}*`
      ].join("\n");

      const thumbBuffer = await fetchThumbnailBuffer(data.thumbnail);

      if (thumbBuffer) {
        const thumbMedia = new MessageMedia(
          "image/jpeg",
          thumbBuffer.toString("base64"),
          "thumb.jpg"
        );

        await message.reply(thumbMedia, undefined, {
          caption: infoMessage
        });
      } else {
        await message.reply(infoMessage);
      }

      const videoBuffer = await fetchBuffer(data.downloadUrl, MAX_VIDEO_SIZE);
      const media = new MessageMedia(
        "video/mp4",
        videoBuffer.toString("base64"),
        `${sanitizeFileName(data.title)}.mp4`
      );

      await message.reply(media, undefined, {
        caption: `Video descargado\nCalidad: ${data.quality}\nTamano: ${sizeText}`
      });
    } catch (e) {
      console.error("Error en ytmp4.js:", e);
      await message.reply(`Error descargando video.\n\n${e.message}`);
    }
  }
}
