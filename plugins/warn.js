import fs from "fs";
import path from "path";

const WARN_FILE = path.resolve("./data/warns.json");

function loadWarns() {
  if (!fs.existsSync(WARN_FILE)) return {};
  return JSON.parse(fs.readFileSync(WARN_FILE));
}

function saveWarns(data) {
  fs.writeFileSync(WARN_FILE, JSON.stringify(data, null, 2));
}

export default {
  name: "warn",
  description: "Advertir a un usuario",

  async execute({ message }) {
    try {
      const chat = await message.getChat();

      if (!chat.isGroup) {
        return await message.reply("❌ Solo en grupos.");
      }

      let userId;

      if (message.mentionedIds.length > 0) {
        userId = message.mentionedIds[0];
      } else if (message.hasQuotedMsg) {
        const quoted = await message.getQuotedMessage();
        userId = quoted.author || quoted.from;
      }

      if (!userId) {
        return await message.reply("❌ Mencioná a alguien.");
      }

      const warns = loadWarns();

      if (!warns[chat.id._serialized]) {
        warns[chat.id._serialized] = {};
      }

      if (!warns[chat.id._serialized][userId]) {
        warns[chat.id._serialized][userId] = 0;
      }

      warns[chat.id._serialized][userId]++;

      const count = warns[chat.id._serialized][userId];

      saveWarns(warns);

      let msg = `⚠️ Advertencia para @${userId.split("@")[0]}\n\nTotal: ${count}/3`;

      if (count >= 3) {
        msg += `\n\n🚨 Última advertencia!`;
      }

      await message.reply(msg, null, {
        mentions: [userId]
      });

    } catch (err) {
      console.error("❌ ERROR WARN:", err);
      await message.reply("⚠️ Error al advertir.");
    }
  }
};