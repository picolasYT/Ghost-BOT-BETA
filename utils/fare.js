import { normalizeYoutubeUrl } from "./youtube.js";

const USER_AGENT = "Mozilla/5.0";
const MAX_AUDIO_SIZE = 45 * 1024 * 1024;
const MAX_VIDEO_SIZE = 55 * 1024 * 1024;

async function importModule(name) {
  const mod = await import(name);
  return mod.default || mod;
}

export async function searchYoutube(query) {
  const yts = await importModule("yt-search");
  return await yts(query);
}

export function isYoutubeUrl(url = "") {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url);
}

export function getVideoId(text = "") {
  const raw = String(text || "").trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  return (
    raw.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/)|[?&]v=)([a-zA-Z0-9_-]{11})/
    )?.[1] || null
  );
}

export async function getYoutubeUrl(input) {
  const normalized = normalizeYoutubeUrl(input);
  const id = getVideoId(normalized);

  if (id) return `https://youtu.be/${id}`;
  if (isYoutubeUrl(normalized)) return normalized;

  const search = await searchYoutube(input);
  const video = search.videos?.[0] || search.all?.find((item) => item.type === "video");

  if (!video?.url) {
    throw new Error("No se encontro un video valido de YouTube.");
  }

  return normalizeYoutubeUrl(video.url);
}

export function sanitizeFileName(name = "file") {
  return String(name)
    .replace(/\.(mp3|m4a|opus|ogg|wav|flac|mp4|mkv|webm|mov|avi)$/i, "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "file";
}

export function formatViews(views = 0) {
  if (views >= 1e9) return `${(views / 1e9).toFixed(1)}B`;
  if (views >= 1e6) return `${(views / 1e6).toFixed(1)}M`;
  if (views >= 1e3) return `${(views / 1e3).toFixed(1)}K`;
  return String(views);
}

export function parseFileSize(size) {
  if (!size) return null;

  const raw = String(size).trim();
  const match = raw.match(/([\d.,]+)\s*(bytes?|b|kb|kib|mb|mib|gb|gib)/i);

  if (!match) return null;

  let valueText = match[1];

  if (valueText.includes(",") && valueText.includes(".")) {
    valueText = valueText.replace(/,/g, "");
  } else {
    valueText = valueText.replace(",", ".");
  }

  const value = Number(valueText);
  if (!Number.isFinite(value) || value <= 0) return null;

  const unit = match[2].toLowerCase();
  const mult = {
    b: 1,
    byte: 1,
    bytes: 1,
    kb: 1024,
    kib: 1024,
    mb: 1024 ** 2,
    mib: 1024 ** 2,
    gb: 1024 ** 3,
    gib: 1024 ** 3
  };

  return Math.round(value * (mult[unit] || 1));
}

export function formatBytes(bytes = 0) {
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

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": USER_AGENT
    }
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Fare API HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Respuesta invalida de Fare API: ${text.slice(0, 200)}`);
  }
}

function getNested(obj, paths) {
  for (const path of paths) {
    const value = path.split(".").reduce((acc, key) => acc?.[key], obj);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function mapFareResponse(json, fallbackUrl, kind) {
  const downloadUrl = getNested(json, [
    "descarga.url",
    "download.url",
    "result.url",
    "result.download",
    "url"
  ]);

  if (!downloadUrl) {
    throw new Error("La API no devolvio una URL de descarga.");
  }

  const size =
    getNested(json, ["descarga.tamaño", "descarga.tamano", "download.size", "size"]) || null;

  return {
    status: Boolean(getNested(json, ["status"]) ?? true),
    title: getNested(json, ["titulo", "title", "result.title"]) || (kind === "audio" ? "audio" : "video"),
    channel: getNested(json, ["canal.nombre", "canal.name", "author", "channel", "result.author"]) || "Desconocido",
    duration: getNested(json, ["duracion", "duration", "result.duration"]) || "Desconocido",
    views: Number(getNested(json, ["vistas", "views", "result.views"]) || 0),
    thumbnail: getNested(json, ["miniatura", "thumbnail", "thumb", "image", "result.thumbnail"]) || null,
    quality: getNested(json, ["descarga.calidad", "download.quality", "quality"]) || (kind === "audio" ? "audio" : "360p"),
    sizeText: size || "Desconocido",
    sizeBytes: parseFileSize(size),
    downloadUrl,
    sourceUrl: fallbackUrl
  };
}

export async function getFareAudio(url) {
  const json = await fetchJson(`https://fare.ink/dl/yta?url=${encodeURIComponent(url)}`);
  return mapFareResponse(json, url, "audio");
}

export async function getFareVideo(url) {
  const json = await fetchJson(`https://fare.ink/dl/ytv?url=${encodeURIComponent(url)}`);
  return mapFareResponse(json, url, "video");
}

export async function getRemoteFileSize(url) {
  const head = await fetch(url, {
    method: "HEAD",
    headers: { "user-agent": USER_AGENT }
  }).catch(() => null);

  let length = head?.headers?.get("content-length");
  let bytes = Number(length);

  if (Number.isFinite(bytes) && bytes > 0) {
    return bytes;
  }

  const range = await fetch(url, {
    method: "GET",
    headers: {
      range: "bytes=0-0",
      "user-agent": USER_AGENT
    }
  }).catch(() => null);

  const contentRange = range?.headers?.get("content-range");
  const match = contentRange?.match(/\/(\d+)$/);

  if (match?.[1]) {
    bytes = Number(match[1]);
    if (Number.isFinite(bytes) && bytes > 0) return bytes;
  }

  length = range?.headers?.get("content-length");
  bytes = Number(length);

  return Number.isFinite(bytes) && bytes > 0 ? bytes : null;
}

export async function fetchBuffer(url, maxBytes) {
  const res = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT
    }
  });

  if (!res.ok) {
    throw new Error(`No se pudo descargar el archivo. HTTP ${res.status}`);
  }

  const length = Number(res.headers.get("content-length") || 0);
  if (length && maxBytes && length > maxBytes) {
    throw new Error("El archivo pesa demasiado para enviarlo por WhatsApp.");
  }

  const buffer = Buffer.from(await res.arrayBuffer());

  if (maxBytes && buffer.length > maxBytes) {
    throw new Error("El archivo pesa demasiado para enviarlo por WhatsApp.");
  }

  return buffer;
}

export async function fetchThumbnailBuffer(url) {
  if (!url) return null;

  const res = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT
    }
  }).catch(() => null);

  if (!res?.ok) return null;

  const buffer = Buffer.from(await res.arrayBuffer());
  return buffer.length ? buffer : null;
}

export { MAX_AUDIO_SIZE, MAX_VIDEO_SIZE };
