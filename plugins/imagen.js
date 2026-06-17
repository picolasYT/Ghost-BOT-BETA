export default {
  name: "imagen",
  aliases: ["image", "img"],
  category: "search",
  description: "Busca imágenes.",

  async execute({ message, args, config }) {
    try {
      const prefix = config.prefix || "!"
      const query = args.join(" ").trim()

      if (!query) {
        return await message.reply(`🖼️ Usá:\n${prefix}imagen lo que querés buscar`)
      }

      const googleImages = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`

      await message.reply(
        `🖼️ *Búsqueda de imágenes*\n\n` +
        `📝 *Consulta:* ${query}\n` +
        `🔗 ${googleImages}`
      )
    } catch (e) {
      console.error("❌ Error en imagen.js:", e)
      await message.reply(`❌ Error buscando imágenes.\n\n${e.message}`)
    }
  }
}