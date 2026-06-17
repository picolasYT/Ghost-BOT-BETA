export default {
  name: "echo",
  aliases: ["say", "decir"],
  description: "Repite el mensaje que envíes", 
  async execute({ message, config }) {
    // Extraemos el texto luego del comando
    const body = message.body || "";
    const args = body.trim().split(/\s+/).slice(1);
    const text = args.join(" ");
    if (!text) {
      return await message.reply(`⚠️ Usa: ${config.prefix}echo <texto>`);
    }
    await message.reply(text);
  }
};