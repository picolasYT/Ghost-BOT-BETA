function safeName(text = "media") {
  return String(text)
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "media";
}

function guessExtension(mimetype = "") {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "application/pdf": "pdf"
  };

  if (map[mimetype]) return map[mimetype];
  return mimetype.split("/")[1] || "bin";
}

function formatBytes(bytes = 0) {
  if (!bytes || Number.isNaN(bytes)) return "Desconocido";

  const units = ["B", "KB", "MB", "GB"];
  let size = Number(bytes);
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }

  return `${size.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}

export function isViewOnceMessage(message) {
  const data = message?._data || {};

  return Boolean(
    data.isViewOnce ||
      data.viewOnce ||
      data.isEphemeral ||
      data.isViewOnceV2 ||
      data.viewOnceMessage ||
      data.isViewOnceMedia
  );
}

export async function getQuotedNormalMedia(message) {
  if (!message.hasQuotedMsg) {
    throw new Error("Responde a una foto, video, audio o documento.");
  }

  const quoted = await message.getQuotedMessage();

  if (!quoted?.hasMedia) {
    throw new Error("El mensaje citado no tiene media.");
  }

  if (isViewOnceMessage(quoted)) {
    throw new Error("Ese mensaje parece ser de ver una vez y no puedo procesarlo.");
  }

  const media = await quoted.downloadMedia();

  if (!media?.data) {
    throw new Error("No se pudo descargar el medio citado.");
  }

  return {
    quoted,
    media
  };
}

export function buildMediaFileName(media, quoted) {
  const ext = guessExtension(media.mimetype);
  const base =
    safeName(
      quoted?._data?.filename ||
        quoted?._data?.caption ||
        quoted?.type ||
        quoted?._data?.type ||
        "media"
    ) || "media";

  return `${base}.${ext}`;
}

export function buildMediaSummary(quoted, media) {
  const bytes = media?.filesize || Buffer.from(media.data, "base64").length;

  return [
    `Tipo: ${quoted?.type || "media"}`,
    `Mimetype: ${media?.mimetype || "Desconocido"}`,
    `Tamano: ${formatBytes(bytes)}`,
    `Autor: ${quoted?.author || quoted?.from || "Desconocido"}`
  ].join("\n");
}

export { formatBytes };
