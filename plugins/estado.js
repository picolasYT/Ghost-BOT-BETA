import { buildRuntimeSummary } from "../utils/runtime.js";

export default {
  name: "estado",
  aliases: ["runtime", "system", "plataforma", "status"],
  category: "system",
  description: "Muestra provider, plataforma, auth y datos del bot.",

  async execute({ client, message, config, runtime }) {
    const summary = buildRuntimeSummary(runtime, config, client.commands.size);

    await message.reply(`*ESTADO DEL BOT*\n\n${summary}`);
  }
}
