import { startSubbot, stopSubbot } from "../utils/subbotManager.js";

function cleanPhone(text = "") {
  return text.replace(/\D/g, "");
}

function toJid(phone = "") {
  const normalized = cleanPhone(phone);
  return normalized ? `${normalized}@s.whatsapp.net` : "";
}

function phoneFromJid(candidate = "") {
  const raw = String(candidate || "");

  if (!raw || raw.includes("@lid") || raw.endsWith("@g.us")) {
    return "";
  }

  return cleanPhone(raw);
}

function getSenderPhone(message, config, client) {
  if (message?.fromMe) {
    const ownCandidates = [
      config?.ownerNumber,
      config?.phoneNumber,
      client?.info?.wid?._serialized
    ];

    for (const candidate of ownCandidates) {
      const phone = cleanPhone(candidate || "");
      if (phone.length >= 8) return phone;
    }
  }

  const candidates = [
    message?.author,
    message?.from,
    message?._data?.author,
    message?._data?.id?._serialized,
    message?._data?.id?.remote
  ];

  for (const candidate of candidates) {
    const phone = phoneFromJid(candidate);
    if (phone.length >= 8) return phone;
  }

  return "";
}

function resolveOwnerChatJid(message, config, client) {
  const directChat = String(message?.from || "");

  if (directChat && !directChat.includes("@lid")) {
    return directChat;
  }

  const candidates = [
    config?.ownerNumber,
    config?.phoneNumber,
    client?.info?.wid?._serialized,
    getSenderPhone(message, config, client)
  ];

  for (const candidate of candidates) {
    const jid = toJid(candidate);
    if (jid) return jid;
  }

  return directChat;
}

async function respondToRequester({ client, message, config }, text) {
  const targetJid = resolveOwnerChatJid(message, config, client);

  if (targetJid && targetJid !== message.from) {
    try {
      await client.sendMessage(targetJid, text);
      return;
    } catch {}
  }

  await message.reply(text);
}

export default {
  name: "code",
  aliases: ["subbot", "serbot"],
  category: "subbots",
  description: "Genera codigo para convertir un numero en subbot.",

  async execute({ client, message, args, config, MessageMedia, fs, path, cacheDir }) {
    try {
      const prefix = config.prefix || "!";

      if (message.from.endsWith("@g.us")) {
        return await respondToRequester({ client, message, config },
          `Por seguridad usa este comando en privado.\n\nEjemplo:\n${prefix}code 549112345678`
        );
      }

      const action = args[0]?.toLowerCase();

      if (action === "stop") {
        const phone = args[1] || getSenderPhone(message, config, client);

        if (!phone) {
          return await respondToRequester({ client, message, config }, `Usa:\n${prefix}code stop 549112345678`);
        }

        await stopSubbot(phone);
        return await respondToRequester({ client, message, config }, "Subbot apagado correctamente.");
      }

      const phone = args.join(" ").trim() || getSenderPhone(message, config, client);

      if (!phone) {
        return await respondToRequester({ client, message, config },
          `Convertirse en subbot\n\nUsa:\n${prefix}code\n\nSi lo mandas en privado, intento detectar tu numero automaticamente. Tambien podes usar:\n${prefix}code 549112345678`
        );
      }

      await respondToRequester({ client, message, config }, "Iniciando subbot, espera unos segundos...");

      const ownerChat = resolveOwnerChatJid(message, config, client);

      const result = await startSubbot({
        phone,
        mainClient: client,
        config,
        MessageMedia,
        fs,
        path,
        cacheDir,
        ownerChat,
        notifyOwner: true
      });

      if (result.alreadyLinked || result.pairingCode === "YA_VINCULADO") {
        return await respondToRequester({ client, message, config },
          "Ese numero ya estaba vinculado como subbot. No hace falta generar un codigo nuevo."
        );
      }

      await respondToRequester({ client, message, config },
        `Numero detectado: ${result.phone}\n\nEntra en WhatsApp a:\nDispositivos vinculados > Vincular con numero de telefono\n\nTe mando el codigo en el siguiente mensaje para que lo copies mas facil.`
      );

      await respondToRequester({ client, message, config }, result.pairingCode);
    } catch (error) {
      console.error("Error en code.js:", error);
      await respondToRequester({ client, message, config }, `Error creando subbot.\n\nError: ${error.message}`);
    }
  }
};
