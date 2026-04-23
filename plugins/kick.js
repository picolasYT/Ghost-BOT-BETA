export default {
  name: "kick",
  description: "Expulsa a un usuario (solo admins)",

  async execute({ client, message }) {
    try {
      const chat = await message.getChat();

      // 🔹 Solo grupos
      if (!chat.isGroup) {
        return await message.reply("❌ Este comando es solo para grupos.");
      }

      // 🔹 Participantes
      const participants = chat.participants;

      const senderId = message.author || message.from;
      const botId = client.info.wid._serialized;

      const sender = participants.find(p => p.id._serialized === senderId);
      const bot = participants.find(p => p.id._serialized === botId);

      // 🔒 Solo admins pueden usar
      if (!sender?.isAdmin) {
        return await message.reply("🔒 Solo los administradores pueden usar este comando.");
      }

      // 🤖 El bot debe ser admin
      if (!bot?.isAdmin) {
        return await message.reply("❌ El bot necesita ser administrador.");
      }

      // 🔹 Obtener usuario objetivo
      let userId;

      if (message.mentionedIds.length > 0) {
        userId = message.mentionedIds[0];
      } else if (message.hasQuotedMsg) {
        const quoted = await message.getQuotedMessage();
        userId = quoted.author || quoted.from;
      }

      if (!userId) {
        return await message.reply("❌ Mencioná o respondé a un usuario.");
      }

      const target = participants.find(p => p.id._serialized === userId);

      if (!target) {
        return await message.reply("❌ Usuario no encontrado en el grupo.");
      }

      // 🚫 No expulsar admins
      if (target.isAdmin) {
        return await message.reply("🚫 No podés expulsar a otro administrador.");
      }

      // 🚫 No expulsar al bot
      if (userId === botId) {
        return await message.reply("🤖 No puedo eliminarme.");
      }

      // 🔥 Expulsar
      await chat.removeParticipants([userId]);

      await message.reply(
        `👢 Usuario expulsado: @${userId.split("@")[0]}`,
        null,
        { mentions: [userId] }
      );

    } catch (err) {
      console.error("❌ ERROR KICK:", err);
      await message.reply("⚠️ Error al expulsar al usuario.");
    }
  }
};