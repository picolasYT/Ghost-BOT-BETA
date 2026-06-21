function normalizeJid(jid = "") {
  if (!jid || !jid.includes("@")) return jid

  const [left, domain] = jid.split("@")
  const user = left.split(":")[0]
  return `${user}@${domain}`
}

export default {
  name: "all",
  aliases: ["todos", "tagall"],
  category: "group",
  description: "Menciona a todos sin escribir los tags visibles.",

  async execute({ client, message, args, config }) {
    try {
      const chat = await message.getChat()

      if (!chat.isGroup) {
        return await message.reply("❌ Este comando solo funciona en grupos.")
      }

      const senderId = normalizeJid(message.author || message.from)
      const sender = chat.participants.find(
        p => normalizeJid(p.id._serialized) === senderId
      )

      if (!sender?.isAdmin) {
        return await message.reply("🔒 Solo admins pueden usar este comando.")
      }

      const text = args.join(" ").trim() || "Atención grupo."
      const mentions = chat.participants.map(p => p.id._serialized)

      await client.sendMessage(
        message.from,
        `📢 ${text}`,
        {
          mentions
        }
      )
    } catch (e) {
      console.error("❌ Error en all.js:", e)
      await message.reply(`❌ Error usando all.\n\n${e.message}`)
    }
  }
}
