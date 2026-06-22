import { startSubbot, stopSubbot } from "../utils/subbotManager.js";

function cleanPhone(text = "") {
  return text.replace(/\D/g, "");
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

export default {
  name: "code",
  aliases: ["subbot", "serbot"],
  category: "subbots",
  description: "Genera codigo para convertir un numero en subbot.",

  async execute({ client, message, args, config, MessageMedia, fs, path, cacheDir }) {
    try {
      const prefix = config.prefix || "!";

      if (message.from.endsWith("@g.us")) {
        return await message.reply(
          `Por seguridad usa este comando en privado.\n\nEjemplo:\n${prefix}code 549112345678`
        );
      }

      const action = args[0]?.toLowerCase();

      if (action === "stop") {
        const phone = args[1] || getSenderPhone(message, config, client);

        if (!phone) {
          return await message.reply(`Usa:\n${prefix}code stop 549112345678`);
        }

        await stopSubbot(phone);
        return await message.reply("Subbot apagado correctamente.");
      }

      const phone = args.join(" ").trim() || getSenderPhone(message, config, client);

      if (!phone) {
        return await message.reply(
          `Convertirse en subbot\n\nUsa:\n${prefix}code\n\nSi lo mandas en privado, intento detectar tu numero automaticamente. Tambien podes usar:\n${prefix}code 549112345678`
        );
      }

      await message.reply("Iniciando subbot, espera unos segundos...");

      const result = await startSubbot({
        phone,
        mainClient: client,
        config,
        MessageMedia,
        fs,
        path,
        cacheDir,
        ownerChat: message.from,
        notifyOwner: true
      });

      if (result.alreadyLinked || result.pairingCode === "YA_VINCULADO") {
        return await message.reply(
          "Ese numero ya estaba vinculado como subbot. No hace falta generar un codigo nuevo."
        );
      }

      await message.reply(
        `Numero detectado: ${result.phone}\n\nEntra en WhatsApp a:\nDispositivos vinculados > Vincular con numero de telefono\n\nTe mando el codigo en el siguiente mensaje para que lo copies mas facil.`
      );

      await message.reply(result.pairingCode);
    } catch (error) {
      console.error("Error en code.js:", error);
      await message.reply(`Error creando subbot.\n\nError: ${error.message}`);
    }
  }
};
