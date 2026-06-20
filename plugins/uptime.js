function formatUptime() {
  const uptimeSec = process.uptime();
  const h = Math.floor(uptimeSec / 3600);
  const m = Math.floor((uptimeSec % 3600) / 60);
  const s = Math.floor(uptimeSec % 60);

  return `${h}h ${m}m ${s}s`;
}

export default {
  name: "uptime",
  aliases: ["tiempo", "online"],
  category: "system",
  description: "Muestra cuanto tiempo lleva encendido el bot.",

  async execute({ message, runtime }) {
    await message.reply(
      `Tiempo activo: ${formatUptime()}\nPlataforma: ${runtime.platform}/${runtime.arch}\nNode: ${runtime.node}`
    );
  }
}
