function cleanPhone(text = "") {
  return text.replace(/\D/g, "");
}

function toOwnerJid(phone = "") {
  const cleaned = cleanPhone(phone);
  return cleaned ? `${cleaned}@s.whatsapp.net` : "";
}

function getSenderName(message) {
  return (
    message?._data?.notifyName ||
    message?._data?.pushname ||
    "Usuario"
  );
}

function getSenderId(message) {
  return message?.author || message?.from || "desconocido";
}

function formatSuggestionReport({ senderName, senderId, chatId, isGroup, text }) {
  return [
    "*NUEVA SUGERENCIA / REPORTE*",
    "",
    `Usuario: ${senderName}`,
    `ID: ${senderId}`,
    `Chat: ${chatId}`,
    `Origen: ${isGroup ? "grupo" : "privado"}`,
    "",
    "Mensaje:",
    text
  ].join("\n");
}

export default {
  name: "sug",
  aliases: ["sugerencia", "report", "bug", "feedback"],
  category: "main",
  description: "Envia una sugerencia, idea o error directamente al owner.",

  async execute({ client, message, args, config }) {
    try {
      const text = args.join(" ").trim();
      const prefix = config.prefix || "!";

      if (!text) {
        return await message.reply(
          [
            "✍️ Escribí una sugerencia o error para enviar al owner.",
            "",
            `Uso: ${prefix}sug agregar comando promote`,
            `Uso: ${prefix}sug el comando sticker falla con videos`
          ].join("\n")
        );
      }

      const ownerJid = toOwnerJid(config.ownerNumber);

      if (!ownerJid) {
        return await message.reply(
          "❌ El owner no configuró un número para recibir sugerencias. Agregá OWNER_NUMBER en el .env."
        );
      }

      const senderName = getSenderName(message);
      const senderId = getSenderId(message);
      const chatId = message?.from || "desconocido";
      const isGroup = chatId.endsWith("@g.us");

      const report = formatSuggestionReport({
        senderName,
        senderId,
        chatId,
        isGroup,
        text
      });

      await client.sendMessage(ownerJid, report);

      await message.reply(
        "✅ Tu sugerencia fue enviada al owner. Gracias por ayudar a mejorar el bot."
      );
    } catch (e) {
      console.error("Error en sug.js:", e);
      await message.reply(`❌ No pude enviar tu sugerencia.\n\n${e.message}`);
    }
  }
};
