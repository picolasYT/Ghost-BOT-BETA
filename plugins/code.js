import { startSubbot, stopSubbot } from "../utils/subbotManager.js";

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
        const phone = args[1] || "";

        if (!phone) {
          return await message.reply(`⚠️ Usá:\n${prefix}code stop 549112345678`);
        }

        await stopSubbot(phone);
        return await message.reply("✅ Subbot apagado correctamente.");
      }

      const phone = args.join(" ");

      if (!phone) {
        return await message.reply(
          `📲 *Convertirse en subbot*\n\nUsá:\n${prefix}code 549112345678\n\nEl número debe ir con código de país y sin +, espacios ni guiones.`
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

      await message.reply(
        `🔐 *Código de emparejamiento:*\n\n*${result.pairingCode}*\n\n📲 En WhatsApp entrá a:\nDispositivos vinculados > Vincular con número de teléfono\n\n⏱️ El código puede vencer rápido.`
      );
    } catch (error) {
      console.error("Error en code.js:", error);
      await message.reply(`❌ Error creando subbot.\n\nError: ${error.message}`);
    }
  }
};
