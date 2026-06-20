const menuImage = "https://files.catbox.moe/i8twyd.png";

const categoryAliases = {
  main: ["main", "general", "inicio"],
  search: ["search", "buscar", "busqueda", "busquedas"],
  download: ["download", "downloads", "descarga", "descargas"],
  media: ["media", "convertir", "conversion", "stickers"],
  group: ["group", "grupo", "grupos", "admin"],
  system: ["system", "sistema", "owner", "dev"],
  subbots: ["subbots", "subbot", "bots", "serbot"]
};

function normalize(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function formatTime() {
  return new Date().toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatDate() {
  return new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatUptime() {
  const uptimeSec = Math.floor(process.uptime());
  const h = Math.floor(uptimeSec / 3600);
  const m = Math.floor((uptimeSec % 3600) / 60);
  const s = uptimeSec % 60;

  return `${h}h ${m}m ${s}s`;
}

function getUniqueCommands(client) {
  const unique = new Map();

  for (const command of client.commands.values()) {
    if (!command?.name || !command?.execute) continue;
    unique.set(command.name, command);
  }

  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function buildCategories(client) {
  const categories = {};

  for (const command of getUniqueCommands(client)) {
    const category = command.category || "main";

    if (!categories[category]) {
      categories[category] = [];
    }

    categories[category].push(command);
  }

  return categories;
}

function resolveCategory(input, categories) {
  if (!input) return null;

  const wanted = normalize(input);
  const exact = Object.keys(categories).find((key) => normalize(key) === wanted);
  if (exact) return exact;

  return Object.keys(categoryAliases).find((key) =>
    categoryAliases[key].some((alias) => normalize(alias) === wanted)
  );
}

function getSenderName(message) {
  return message._data?.notifyName || message._data?.pushname || "Usuario";
}

function renderCategoryList(prefix, categories) {
  return Object.keys(categories)
    .sort()
    .map((category) => {
      const total = categories[category].length;
      return `│ ◦ *${prefix}menu ${category}* (${total})`;
    })
    .join("\n");
}

function renderCategoryCommands(prefix, category, commands) {
  const header = [
    "╭══〔 MENU DE CATEGORIA 〕═⬣",
    `│ Categoria: *${category}*`,
    `│ Comandos: *${commands.length}*`,
    "╰══════════════════⬣",
    ""
  ];

  const rows = commands.map((cmd) => {
    const desc = cmd.description || "Sin descripcion.";
    return `│ ✦ *${prefix}${cmd.name}*\n│   ${desc}`;
  });

  return [...header, ...rows, "╰══════════════════⬣"].join("\n");
}

function renderMainMenu({ prefix, botName, ownerName, sender, totalCommands, categories }) {
  return [
    "╭══〔 GHOST BOT MENU 〕═⬣",
    `│ Bot: *${botName}*`,
    `│ Owner: *${ownerName}*`,
    `│ Usuario: *${sender}*`,
    `│ Hora: *${formatTime()}*`,
    `│ Fecha: *${formatDate()}*`,
    `│ Uptime: *${formatUptime()}*`,
    `│ Comandos: *${totalCommands}*`,
    "╰══════════════════⬣",
    "",
    "╭══〔 CATEGORIAS 〕═⬣",
    renderCategoryList(prefix, categories),
    "╰══════════════════⬣",
    "",
    "╭══〔 USO 〕═⬣",
    `│ ${prefix}menu`,
    `│ ${prefix}menu download`,
    `│ ${prefix}menu search`,
    "╰══════════════════⬣"
  ].join("\n");
}

export default {
  name: "menu",
  aliases: ["menu2", "help", "ayuda", "comandos", "allmenu"],
  category: "main",
  description: "Muestra el menu principal y categorias del bot.",

  async execute({ client, message, args, config, MessageMedia }) {
    try {
      const prefix = config.prefix || "!";
      const botName = config.botName || "Ghost-Bot";
      const ownerName = config.ownerName || "Owner";
      const sender = getSenderName(message);
      const categories = buildCategories(client);
      const selectedRaw = args.join(" ").trim();
      const selectedCategory = resolveCategory(selectedRaw, categories);

      if (selectedRaw && !selectedCategory) {
        return await message.reply(
          [
            `La categoria *${selectedRaw}* no existe.`,
            "",
            "Categorias disponibles:",
            Object.keys(categories)
              .sort()
              .map((category) => `- ${category}`)
              .join("\n"),
            "",
            `Usa *${prefix}menu* para ver el menu completo.`
          ].join("\n")
        );
      }

      if (selectedCategory) {
        return await message.reply(
          renderCategoryCommands(prefix, selectedCategory, categories[selectedCategory])
        );
      }

      const text = renderMainMenu({
        prefix,
        botName,
        ownerName,
        sender,
        totalCommands: getUniqueCommands(client).length,
        categories
      });

      try {
        const media = await MessageMedia.fromUrl(menuImage, {
          unsafeMime: true
        });

        await message.reply(media, undefined, {
          caption: text
        });
      } catch {
        await message.reply(text);
      }
    } catch (e) {
      console.error("Error en menu.js:", e);
      await message.reply(`Error al ejecutar el menu.\n\n${e.message}`);
    }
  }
}
