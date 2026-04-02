export default {
  name: "menu",
  description: "Muestra el menú de comandos",
  async execute({ message, client, config }) {
    const list = [...client.commands.values()]
      .map(cmd => `• ${config.prefix}${cmd.name} - ${cmd.description || "Sin descripción"}`)
      .join("\n");

    await message.reply(
      `🤖 *${config.botName}*\n\n` +
      `📚 *Comandos disponibles:*\n${list}`
    );
  }
};