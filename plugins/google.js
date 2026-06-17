export default {
  name: "google",
  aliases: ["buscar", "search"],
  category: "search",
  description: "Busca algo en Google.",

  async execute({ message, args, config }) {
    try {
      const prefix = config.prefix || "!"
      const query = args.join(" ").trim()

      if (!query) {
        return await message.reply(`🔎 Usá:\n${prefix}google qué querés buscar`)
      }

      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`

      let extra = ""

      try {
        const api = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`
        const res = await fetch(api)
        const json = await res.json()

        if (json.AbstractText) {
          extra = `\n\n📌 ${json.AbstractText}`
        }
      } catch {}

      await message.reply(
        `🔎 *Resultado de búsqueda*\n\n` +
        `📝 *Consulta:* ${query}\n` +
        `🔗 ${googleUrl}` +
        extra
      )
    } catch (e) {
      console.error("❌ Error en google.js:", e)
      await message.reply(`❌ Error buscando en Google.\n\n${e.message}`)
    }
  }
}