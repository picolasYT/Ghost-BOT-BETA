import fs from "fs";
import path from "path";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  getContentType,
  isJidGroup,
  jidDecode,
  makeCacheableSignalKeyStore,
  normalizeMessageContent,
  proto,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";
import { Boom } from "@hapi/boom";
import config from "../config.js";
import { logError, logInfo, logStep, logSuccess, logWarn } from "./logger.js";
import { detectRuntime, resolveAuthPath } from "./runtime.js";
import { patchBotState } from "./appState.js";

const logger = pino({ level: "silent" });
const messageStore = global.baileysMessageStore || (global.baileysMessageStore = new Map());

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanPhone(text = "") {
  return text.replace(/\D/g, "");
}

function toSerializedJid(jid = "") {
  if (!jid) return "";
  if (jid.includes("@")) return jid;
  return `${jid}@s.whatsapp.net`;
}

function getTextFromMessageContent(content) {
  if (!content) return "";

  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    content.buttonsResponseMessage?.selectedDisplayText ||
    content.listResponseMessage?.title ||
    content.templateButtonReplyMessage?.selectedDisplayText ||
    content.interactiveResponseMessage?.body?.text ||
    ""
  );
}

function getMentionedIds(rawMessage) {
  const normalized = normalizeMessageContent(rawMessage.message) || rawMessage.message || {};
  const contentType = getContentType(normalized);
  const content = contentType ? normalized[contentType] : normalized;
  return content?.contextInfo?.mentionedJid || [];
}

function getQuotedKey(rawMessage) {
  const normalized = normalizeMessageContent(rawMessage.message) || rawMessage.message || {};
  const contentType = getContentType(normalized);
  const content = contentType ? normalized[contentType] : normalized;
  const contextInfo = content?.contextInfo;

  if (!contextInfo?.stanzaId) return null;

  return {
    id: contextInfo.stanzaId,
    remoteJid: rawMessage.key.remoteJid,
    participant: contextInfo.participant || contextInfo.remoteJid || rawMessage.key.remoteJid
  };
}

function isViewOnceContent(messageContent) {
  const normalized = normalizeMessageContent(messageContent) || messageContent || {};
  return Boolean(
    normalized.viewOnceMessage ||
      normalized.viewOnceMessageV2 ||
      normalized.viewOnceMessageV2Extension
  );
}

function getMediaNode(normalized) {
  const mediaTypes = [
    "imageMessage",
    "videoMessage",
    "audioMessage",
    "documentMessage",
    "stickerMessage"
  ];

  const contentType = getContentType(normalized);
  if (contentType && mediaTypes.includes(contentType)) {
    return {
      type: contentType,
      node: normalized[contentType]
    };
  }

  for (const type of mediaTypes) {
    if (normalized?.[type]) {
      return {
        type,
        node: normalized[type]
      };
    }
  }

  return null;
}

function mimeToMessageKind(mimetype = "", options = {}) {
  if (options.sendMediaAsSticker || mimetype.includes("webp")) return "sticker";
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("audio/")) return "audio";
  return "document";
}

export class CompatMessageMedia {
  constructor(mimetype, data, filename = "") {
    this.mimetype = mimetype;
    this.data = data;
    this.filename = filename;
  }

  static async fromUrl(url) {
    const res = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0"
      }
    });

    if (!res.ok) {
      throw new Error(`No se pudo descargar media desde URL. HTTP ${res.status}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const mimetype = res.headers.get("content-type") || "application/octet-stream";
    const nameFromUrl = new URL(url).pathname.split("/").filter(Boolean).pop() || "media";

    return new CompatMessageMedia(mimetype, buffer.toString("base64"), nameFromUrl);
  }
}

async function sendCompatMessage(sock, jid, content, options = {}, quoted) {
  const mentions = options.mentions || [];

  if (typeof content === "string") {
    return await sock.sendMessage(
      jid,
      {
        text: content,
        mentions
      },
      quoted ? { quoted } : {}
    );
  }

  if (content instanceof CompatMessageMedia) {
    const buffer = Buffer.from(content.data, "base64");
    const kind = mimeToMessageKind(content.mimetype, options);
    const caption = options.caption;

    if (kind === "sticker") {
      return await sock.sendMessage(
        jid,
        {
          sticker: buffer,
          mimetype: "image/webp"
        },
        quoted ? { quoted } : {}
      );
    }

    if (kind === "image") {
      return await sock.sendMessage(
        jid,
        {
          image: buffer,
          caption,
          mimetype: content.mimetype,
          mentions
        },
        quoted ? { quoted } : {}
      );
    }

    if (kind === "video") {
      return await sock.sendMessage(
        jid,
        {
          video: buffer,
          caption,
          mimetype: content.mimetype,
          gifPlayback: Boolean(options.sendVideoAsGif),
          mentions
        },
        quoted ? { quoted } : {}
      );
    }

    if (kind === "audio") {
      return await sock.sendMessage(
        jid,
        {
          audio: buffer,
          mimetype: content.mimetype,
          fileName: content.filename,
          ptt: Boolean(options.sendAudioAsVoice)
        },
        quoted ? { quoted } : {}
      );
    }

    return await sock.sendMessage(
      jid,
      {
        document: buffer,
        mimetype: content.mimetype,
        fileName: content.filename || "archivo",
        caption,
        mentions
      },
      quoted ? { quoted } : {}
    );
  }

  throw new Error("Contenido no soportado por el adaptador de Baileys.");
}

async function buildChatAdapter(sock, rawMessage) {
  const jid = rawMessage.key.remoteJid;
  const isGroup = isJidGroup(jid);
  const metadata = isGroup ? await sock.groupMetadata(jid) : null;

  return {
    id: {
      _serialized: jid
    },
    isGroup,
    participants: (metadata?.participants || []).map((participant) => ({
      id: {
        _serialized: participant.id
      },
      isAdmin: ["admin", "superadmin"].includes(participant.admin || "")
    })),
    async removeParticipants(participants) {
      return await sock.groupParticipantsUpdate(jid, participants, "remove");
    }
  };
}

function resolveQuotedMessage(rawMessage) {
  const quotedKey = getQuotedKey(rawMessage);
  if (!quotedKey) return null;

  return (
    messageStore.get(quotedKey.id) ||
    null
  );
}

function buildDataShape(rawMessage, normalized, mediaInfo) {
  const mediaNode = mediaInfo?.node;

  return {
    id: {
      id: rawMessage.key.id,
      _serialized: rawMessage.key.id
    },
    notifyName: rawMessage.pushName,
    pushname: rawMessage.pushName,
    filename: mediaNode?.fileName || "",
    caption:
      normalized?.imageMessage?.caption ||
      normalized?.videoMessage?.caption ||
      normalized?.documentMessage?.caption ||
      "",
    mimetype: mediaNode?.mimetype || "",
    type: mediaInfo?.type || getContentType(normalized) || "conversation",
    isViewOnce: isViewOnceContent(rawMessage.message)
  };
}

function buildMessageAdapter(sock, rawMessage) {
  const normalized = normalizeMessageContent(rawMessage.message) || rawMessage.message || {};
  const mediaInfo = getMediaNode(normalized);

  const adapter = {
    raw: rawMessage,
    key: rawMessage.key,
    id: {
      id: rawMessage.key.id,
      _serialized: rawMessage.key.id
    },
    body: getTextFromMessageContent(normalized),
    from: rawMessage.key.remoteJid,
    fromMe: Boolean(rawMessage.key.fromMe),
    author: rawMessage.key.participant || rawMessage.key.remoteJid,
    mentionedIds: getMentionedIds(rawMessage),
    hasQuotedMsg: Boolean(getQuotedKey(rawMessage)),
    hasMedia: Boolean(mediaInfo?.node),
    type: mediaInfo?.type || getContentType(normalized) || "conversation",
    _data: buildDataShape(rawMessage, normalized, mediaInfo),
    async reply(content, _unused, options = {}) {
      return await sendCompatMessage(sock, rawMessage.key.remoteJid, content, options, rawMessage);
    },
    async getQuotedMessage() {
      const quotedRaw = resolveQuotedMessage(rawMessage);
      if (!quotedRaw) {
        throw new Error("No se encontro el mensaje citado en memoria.");
      }

      return buildMessageAdapter(sock, quotedRaw);
    },
    async downloadMedia() {
      if (!mediaInfo?.node) return null;

      const buffer = await downloadMediaMessage(
        rawMessage,
        "buffer",
        {},
        {
          logger,
          reuploadRequest: sock.updateMediaMessage
        }
      );

      const filename =
        mediaInfo.node.fileName ||
        `${rawMessage.key.id}.${(mediaInfo.node.mimetype || "").split("/")[1] || "bin"}`;

      return {
        data: buffer.toString("base64"),
        mimetype: mediaInfo.node.mimetype || "application/octet-stream",
        filename,
        filesize: buffer.length
      };
    },
    async getChat() {
      return await buildChatAdapter(sock, rawMessage);
    }
  };

  return adapter;
}

function buildClientAdapter(sock) {
  const adapter = {
    sock,
    commands: new Map(),
    info: {
      wid: {}
    },
    async sendMessage(jid, content, options = {}) {
      if (typeof content === "string") {
        return await sock.sendMessage(jid, {
          text: content,
          mentions: options.mentions || []
        });
      }

      return await sendCompatMessage(sock, jid, content, options);
    },
    async logout() {
      return await sock.logout();
    },
    async destroy() {
      try {
        sock.ws.close();
      } catch {}
    }
  };

  Object.defineProperty(adapter.info.wid, "_serialized", {
    get() {
      return sock.user?.id || "";
    }
  });

  return adapter;
}

function getSessionFolder(baseAuthPath, clientId) {
  return path.join(baseAuthPath, clientId);
}

function shouldReconnect(lastDisconnect) {
  const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
  return statusCode !== DisconnectReason.loggedOut;
}

export async function createBaileysRuntime() {
  const runtime = detectRuntime();
  const authRoot = resolveAuthPath(config.authPath);
  const clientId = "ghost-bot";
  return await createBaileysSessionRuntime({
    clientId,
    botName: config.botName || "Ghost-Bot",
    authPath: config.authPath,
    isSubbot: false
  });
}

export async function createBaileysSessionRuntime({
  clientId,
  botName = "Ghost-Bot",
  authPath = config.authPath,
  isSubbot = false
}) {
  const runtime = detectRuntime();
  const authRoot = resolveAuthPath(authPath);
  const sessionDir = getSessionFolder(authRoot, clientId);

  ensureDir(authRoot);
  ensureDir(sessionDir);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    version,
    logger,
    browser: Browsers.ubuntu(botName),
    markOnlineOnConnect: false,
    printQRInTerminal: false,
    syncFullHistory: false
  });

  const client = buildClientAdapter(sock);
  client.runtime = runtime;
  client.authPath = sessionDir;
  client.isSubbot = isSubbot;

  sock.ev.on("creds.update", saveCreds);

  return {
    sock,
    client,
    runtime,
    authPath: sessionDir,
    MessageMedia: CompatMessageMedia,
    isRegistered: state.creds.registered
  };
}

export async function bindBaileysEvents({
  sock,
  client,
  handleCommand,
  onReconnect
}) {
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && config.loginMethod?.toLowerCase() === "qr") {
      logStep("Escanea este QR con WhatsApp.");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      patchBotState({ status: "ready" });
      logSuccess(`${config.botName} esta listo.`);
      logInfo(`Prefijo: ${config.prefix} | Owner: ${config.ownerName} | Provider: baileys`);
    }

    if (connection === "close") {
      patchBotState({ status: "disconnected" });
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      logWarn(`Bot desconectado: ${statusCode || "sin codigo"}`);

      if (shouldReconnect(lastDisconnect)) {
        logStep("Reconectando Baileys...");
        onReconnect?.();
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const rawMessage of messages) {
      if (!rawMessage.message || !rawMessage.key?.remoteJid) continue;
      if (rawMessage.key.remoteJid === "status@broadcast") continue;

      messageStore.set(rawMessage.key.id, rawMessage);
      const message = buildMessageAdapter(sock, rawMessage);
      await handleCommand(message, client);
    }
  });

}

export async function maybeRequestPairingCode(sock, isRegistered) {
  if (config.loginMethod?.toLowerCase() === "code" && !isRegistered) {
    const phone = cleanPhone(config.phoneNumber || process.env.PHONE_NUMBER || "");

    if (!phone) {
      logWarn("Se selecciono el modo code pero no se proporciono PHONE_NUMBER. Se usara QR.");
    } else {
      const pairingCode = await sock.requestPairingCode(phone);
      logInfo(`Codigo de emparejamiento: ${pairingCode}`);
    }
  }
}
