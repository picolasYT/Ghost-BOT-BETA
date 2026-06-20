import {
  MAX_AUDIO_SIZE,
  fetchBuffer,
  fetchThumbnailBuffer,
  formatBytes,
  getFareAudio,
  getRemoteFileSize,
  getYoutubeUrl,
  sanitizeFileName
} from "../utils/fare.js";

export default {
  name: "ytmp3",
  aliases: ["ytaudio", "yta"],
  category: "download",
  description: "Descarga audio de YouTube usando una API externa.",

  async execute({ message, args, config, MessageMedia }) {
    try {
      const prefix = config.prefix || "!";
      const text = args.join(" ").trim();

      if (!text) {
        return await message.reply(`Usa:\n${prefix}ytmp3 link o nombre de cancion`);
      }

      const url = await getYoutubeUrl(text);
      const data = await getFareAudio(url);

      if (!data?.downloadUrl) {
        return await message.reply("No se pudo descargar el audio. Intenta mas tarde.");
      }

      const sizeBytes = data.sizeBytes || (await getRemoteFileSize(data.downloadUrl).catch(() => null));
      const sizeText = sizeBytes ? formatBytes(sizeBytes) : data.sizeText || "Desconocido";

      const infoMessage = [
        `Descargando: *${data.title}*`,
        "",
        `Canal: *${data.channel}*`,
        `Duracion: *${data.duration}*`,
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

      const audioBuffer = await fetchBuffer(data.downloadUrl, MAX_AUDIO_SIZE);
      const media = new MessageMedia(
        "audio/mpeg",
        audioBuffer.toString("base64"),
        `${sanitizeFileName(data.title)}.mp3`
      );

      await message.reply(media, undefined, {
        sendAudioAsVoice: false
      });
    } catch (e) {
      console.error("Error en ytmp3.js:", e);
      await message.reply(`Error descargando audio.\n\n${e.message}`);
    }
  }
}
