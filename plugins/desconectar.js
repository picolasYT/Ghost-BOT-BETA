export default {
  name: "desconectar",
  aliases: ["desvincular", "logoutbot"],
  category: "subbots",
  description: "Desvincula solo el subbot actual.",

  async execute({ client, message, fs, path, config }) {
    try {
      if (!client?.isSubbot || !client?.subbotMeta) {
        return await message.reply(
          "Este comando solo funciona dentro de un subbot."
        );
      }

      if (!message.fromMe) {
        return await message.reply(
          "Solo la cuenta del propio subbot puede usar este comando."
        );
      }

      const { phone, ownerChat, sessionDir } = client.subbotMeta;

      try {
        await message.reply(
          "Desvinculando este subbot. Espera unos segundos..."
        );
      } catch {}

      try {
        await client.logout();
      } catch {}

      try {
        await client.destroy();
      } catch {}

      try {
        global.subbotStore?.delete(phone);
      } catch {}

      try {
        if (sessionDir && fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        }
      } catch {}

      try {
        if (ownerChat && client.mainClientRef) {
          await client.mainClientRef.sendMessage(
            ownerChat,
            `Subbot ${phone} desconectado y desvinculado correctamente.`
          );
        }
      } catch {}
    } catch (e) {
      console.error("Error en desconectar.js:", e);
      await message.reply(`Error usando desconectar.\n\n${e.message}`);
    }
  }
}
