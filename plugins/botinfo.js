export default {
  name: "botinfo",
  aliases: ["info", "about"],
  description: "Muestra información sobre el bot",
  async execute({ client, message, config }) {
    try {
      const totalCommands = client.commands?.size || 0;
      const prefix = config.prefix || "!";
      const infoMsg =
        `🤖 *${config.botName}*\n` +
        `👑 *Owner:* ${config.ownerName}\n` +
        `📌 *Prefijo:* ${prefix}\n` +
        `📚 *Comandos cargados:* ${totalCommands}\n\n` +
        `Este bot ha sido actualizado para soportar autenticación por QR o por código y contiene nuevos comandos como *echo* y *botinfo*.`;
      await message.reply(infoMsg);
    } catch (err) {
      console.error("❌ ERROR BOTINFO:", err);
      await message.reply("⚠️ Error al obtener información del bot.");
    }
  }
};