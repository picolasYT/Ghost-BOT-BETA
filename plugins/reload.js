export default {
  name: "reload",
  aliases: ["recargar", "reloadplugins"],
  category: "system",
  description: "Recarga los plugins sin reiniciar el bot.",

  async execute({ message, reloadCommands }) {
    if (!message.fromMe) {
      return await message.reply("Solo el owner puede recargar plugins desde su propia cuenta.");
    }

    const total = await reloadCommands();
    await message.reply(`Plugins recargados correctamente. Total: ${total}`);
  }
}
