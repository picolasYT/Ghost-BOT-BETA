const DEFAULT_CLIENTS = ["IOS", "ANDROID", "TV", "WEB_EMBEDDED"];
const FALLBACK_CLIENTS = [
  ["IOS", "ANDROID", "TV", "WEB_EMBEDDED"],
  ["TV", "IOS", "ANDROID"],
  ["ANDROID", "IOS"],
  ["TV"],
  undefined
];

async function importModule(name) {
  const mod = await import(name);
  return mod.default || mod;
}

export function normalizeYoutubeUrl(input) {
  try {
    const url = new URL(input.trim());

    if (!/youtube\.com|youtu\.be/.test(url.hostname)) {
      return input;
    }

    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/watch?v=${id}` : input;
    }

    if (url.pathname.startsWith("/shorts/")) {
      const id = url.pathname.split("/")[2];
      return id ? `https://www.youtube.com/watch?v=${id}` : input;
    }

    return url.toString();
  } catch {
    return input;
  }
}

export async function getYtdl() {
  try {
    return await importModule("@distube/ytdl-core");
  } catch {
    return await importModule("ytdl-core");
  }
}

export async function getYts() {
  return await importModule("yt-search");
}

export function safeName(text = "file") {
  return text.replace(/[\\/:*?"<>|]/g, "").slice(0, 60) || "file";
}

export function formatViews(views = 0) {
  if (views >= 1e9) return `${(views / 1e9).toFixed(1)}B`;
  if (views >= 1e6) return `${(views / 1e6).toFixed(1)}M`;
  if (views >= 1e3) return `${(views / 1e3).toFixed(1)}K`;
  return String(views);
}

export function streamToBuffer(stream, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    stream.on("data", (chunk) => {
      size += chunk.length;

      if (size > limit) {
        stream.destroy();
        reject(new Error("El archivo es demasiado pesado para enviarlo por WhatsApp."));
        return;
      }

      chunks.push(chunk);
    });

    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

export async function resolveYoutube(text, ytdl) {
  const normalized = normalizeYoutubeUrl(text);
  if (ytdl.validateURL(normalized)) return normalized;

  const yts = await getYts();
  const res = await yts(text);

  if (!res?.videos?.length) return null;

  return res.videos[0].url;
}

function createBaseOptions(ytdl) {
  const options = {
    requestOptions: {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
      }
    }
  };

  if (typeof ytdl.createAgent === "function") {
    options.agent = ytdl.createAgent();
  }

  return options;
}

function normalizeError(error) {
  const status =
    error?.statusCode ||
    error?.status ||
    error?.response?.statusCode ||
    error?.response?.status;

  const rawMessage = error?.message || String(error);

  if (status === 402 || status === 403 || /402|403|Sign in to confirm|Forbidden/i.test(rawMessage)) {
    return new Error(
      "YouTube bloqueo esta descarga temporalmente. Proba con otro video o intenta de nuevo en unos minutos."
    );
  }

  return error instanceof Error ? error : new Error(rawMessage);
}

export async function getYoutubeInfo(url, ytdl) {
  const baseOptions = createBaseOptions(ytdl);
  const errors = [];

  for (const playerClients of FALLBACK_CLIENTS) {
    try {
      const options = {
        ...baseOptions
      };

      if (playerClients) {
        options.playerClients = playerClients;
      }

      const info = await ytdl.getInfo(url, options);
      return {
        info,
        options: {
          ...options,
          playerClients: playerClients || DEFAULT_CLIENTS
        }
      };
    } catch (error) {
      errors.push(normalizeError(error));
    }
  }

  throw errors[errors.length - 1] || new Error("No se pudo obtener informacion del video.");
}

export function pickAudioFormat(ytdl, info) {
  return ytdl.chooseFormat(info.formats, {
    quality: "highestaudio",
    filter: (format) =>
      format.hasAudio &&
      !format.hasVideo &&
      !format.isHLS &&
      !format.isDashMPD &&
      ["mp4", "webm", "m4a"].includes(format.container)
  });
}

export function pickVideoFormat(ytdl, info) {
  try {
    return ytdl.chooseFormat(info.formats, {
      quality: "highest",
      filter: (format) =>
        format.hasAudio &&
        format.hasVideo &&
        !format.isHLS &&
        !format.isDashMPD &&
        format.container === "mp4"
    });
  } catch {
    return ytdl.chooseFormat(info.formats, {
      quality: "highest",
      filter: (format) =>
        format.hasAudio &&
        format.hasVideo &&
        !format.isHLS &&
        !format.isDashMPD
    });
  }
}

export async function searchYoutube(query) {
  const yts = await getYts();
  return await yts(query);
}

export async function getYoutubeMetadata(input, ytdl) {
  const normalized = normalizeYoutubeUrl(input);

  if (ytdl.validateURL(normalized)) {
    try {
      const { info } = await getYoutubeInfo(normalized, ytdl);
      const details = info.videoDetails || {};

      return {
        title: details.title || "Video de YouTube",
        author: details.author?.name || details.ownerChannelName || "Desconocido",
        timestamp: details.lengthSeconds
          ? `${Math.floor(Number(details.lengthSeconds) / 60)}:${String(
              Number(details.lengthSeconds) % 60
            ).padStart(2, "0")}`
          : "N/D",
        views: Number(details.viewCount || 0),
        ago: details.publishDate || "N/D",
        url: normalized
      };
    } catch {
      return {
        title: "Video de YouTube",
        author: "Desconocido",
        timestamp: "N/D",
        views: 0,
        ago: "N/D",
        url: normalized
      };
    }
  }

  const res = await searchYoutube(input);
  if (!res?.videos?.length) return null;
  return res.videos[0];
}
