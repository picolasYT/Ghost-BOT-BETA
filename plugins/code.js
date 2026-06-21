import { startSubbot, stopSubbot } from "../utils/subbotManager.js";

function cleanPhone(text = "") {
  return text.replace(/\D/g, "");
}

function getSenderPhone(message) {
  const candidates = [
    message?.author,
    message?.from,
    message?._data?.author,
    message?._data?.id?._serialized,
    message?._data?.id?.remote
  ];

  for (const candidate of candidates) {
    const phone = cleanPhone(candidate || "");
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
          `⚠️ Por seguridad usá este comando en privado.\n\nEjemplo:\n${prefix}code 549112345678`
        );
      }

      const action = args[0]?.toLowerCase();

      if (action === "stop") {
        const phone = args[1] || getSenderPhone(message);

        if (!phone) {
          return await message.reply(`⚠️ Usá:\n${prefix}code stop 549112345678`);
        }

        await stopSubbot(phone);
        return await message.reply("✅ Subbot apagado correctamente.");
      }

      const phone = args.join(" ").trim() || getSenderPhone(message);

      if (!phone) {
        return await message.reply(
          `📲 *Convertirse en subbot*\n\nUsá:\n${prefix}code\n\nSi lo mandás en privado, intento detectar tu número automáticamente. También podés usar:\n${prefix}code 549112345678`
        );
      }

      await message.reply("⏳ Iniciando subbot, esperá unos segundos...");

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
          "ℹ️ Ese número ya estaba vinculado como subbot. No hace falta generar un código nuevo."
        );
      }

      await message.reply(
        `📲 Número detectado: *${result.phone}*\n\nEntrá en WhatsApp a:\nDispositivos vinculados > Vincular con número de teléfono\n\nTe mando el código en el siguiente mensaje para que lo copies más fácil.`
      );

      await message.reply(result.pairingCode);
    } catch (error) {
      console.error("Error en code.js:", error);
      await message.reply(`❌ Error creando subbot.\n\nError: ${error.message}`);
    }
  }
};
