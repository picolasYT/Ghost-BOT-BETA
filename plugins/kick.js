function normalizeJid(jid = "") {
  if (!jid || !jid.includes("@")) return jid;

  const [left, domain] = jid.split("@");
  const user = left.split(":")[0];
  return `${user}@${domain}`;
}

function getJidUser(jid = "") {
  return normalizeJid(jid).split("@")[0] || "";
}

function getDigits(text = "") {
  return text.replace(/\D/g, "");
}

function sameUser(a = "", b = "") {
  const normalizedA = normalizeJid(a);
  const normalizedB = normalizeJid(b);

  if (normalizedA && normalizedA === normalizedB) return true;

  const userA = getJidUser(normalizedA);
  const userB = getJidUser(normalizedB);
  if (userA && userA === userB) return true;

  const digitsA = getDigits(userA);
  const digitsB = getDigits(userB);
  return Boolean(digitsA && digitsB && digitsA === digitsB);
}

export default {
  name: "kick",
  description: "Expulsa a un usuario (solo admins)",

  async execute({ client, message }) {
    try {
      const chat = await message.getChat();

      if (!chat.isGroup) {
        return await message.reply("❌ Este comando es solo para grupos.");
      }

      const participants = chat.participants;
      const senderId = normalizeJid(message.author || message.from);
      const botId = normalizeJid(client.info.wid._serialized);
      const sender = participants.find((p) => sameUser(p.id._serialized, senderId));

      if (!sender?.isAdmin) {
        return await message.reply("🔒 Solo los administradores pueden usar este comando.");
      }

      let userId = "";

      if (message.mentionedIds.length > 0) {
        userId = normalizeJid(message.mentionedIds[0]);
      } else if (message.hasQuotedMsg) {
        const quoted = await message.getQuotedMessage();
        userId = normalizeJid(quoted.author || quoted.from);
      }

      if (!userId) {
        return await message.reply("❌ Mencioná o respondé a un usuario.");
      }

      const target = participants.find((p) => sameUser(p.id._serialized, userId));

      if (!target) {
        return await message.reply("❌ Usuario no encontrado en el grupo.");
      }

      if (target.isAdmin) {
        return await message.reply("🚫 No podés expulsar a otro administrador.");
      }

      if (sameUser(userId, botId)) {
        return await message.reply("🤖 No puedo eliminarme.");
      }

      await chat.removeParticipants([userId]);

      await message.reply(
        `👢 Usuario expulsado: @${getJidUser(userId)}`,
        null,
        { mentions: [userId] }
      );
    } catch (err) {
      console.error("ERROR KICK:", err);

      const detail = String(err?.message || err || "").toLowerCase();
      if (
        detail.includes("not-authorized") ||
        detail.includes("forbidden") ||
        detail.includes("admin") ||
        detail.includes("403")
      ) {
        return await message.reply("❌ El bot necesita ser administrador para expulsar usuarios.");
      }

      await message.reply("⚠️ Error al expulsar al usuario.");
    }
  }
};
