export default {
  name: "ping",
  description: "Responde pong",
  async execute({ message }) {
    await message.reply("🏓 Pong!");
  }
};