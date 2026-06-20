import fs from "fs";
import path from "path";
import {
  buildMediaFileName,
  buildMediaSummary,
  getQuotedNormalMedia
} from "../utils/mediaTools.js";

function getMode(args) {
  const mode = (args[0] || "save").toLowerCase();

  if (["save", "guardar", "cache"].includes(mode)) return "save";
  if (["send", "reenviar", "enviar"].includes(mode)) return "send";
  if (["info", "datos"].includes(mode)) return "info";

  return "save";
}

export default {
  name: "media",
  aliases: ["guardar", "savefile", "archivo"],
  category: "media",
  description: "Guarda en cache o reenvia un medio normal citado.",

  async execute({ message, args, cacheDir, MessageMedia }) {
    try {
      const mode = getMode(args);
      const { quoted, media } = await getQuotedNormalMedia(message);
      const summary = buildMediaSummary(quoted, media);

      if (mode === "info") {
        return await message.reply(summary);
      }

      if (mode === "send") {
        const fileName = buildMediaFileName(media, quoted);
        const resend = new MessageMedia(media.mimetype, media.data, fileName);
        await message.reply(`${summary}\n\nReenviando medio normal...`);
        return await message.reply(resend);
      }

      const mediaDir = path.join(cacheDir, "medios");
      fs.mkdirSync(mediaDir, { recursive: true });

      const fileName = `${Date.now()}-${buildMediaFileName(media, quoted)}`;
      const fullPath = path.join(mediaDir, fileName);
      const buffer = Buffer.from(media.data, "base64");

      fs.writeFileSync(fullPath, buffer);

      await message.reply(
        `${summary}\n\nGuardado en cache:\n${fullPath}`
      );
    } catch (e) {
      console.error("Error en media.js:", e);
      await message.reply(`Error usando media.\n\n${e.message}`);
    }
  }
}
