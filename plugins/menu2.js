import { generateWAMessageFromContent, proto } from "@whiskeysockets/baileys";

const categoryDescriptions = {
  main: "Comandos principales e información",
  search: "Búsquedas y consultas",
  download: "Descargas de videos y audio",
  media: "Stickers y conversión de medios",
  group: "Administración de grupos",
  system: "Sistema y herramientas del owner",
  subbots: "Gestión de sub-bots"
};

function getCommands(client) {
  const unique = new Map();
  for (const command of client.commands.values()) {
    if (command && command.name && command.execute) unique.set(command.name, command);
  }
  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function getCategories(client) {
  const categories = new Map();
  for (const command of getCommands(client)) {
    const name = command.category || "main";
    if (!categories.has(name)) categories.set(name, []);
    categories.get(name).push(command);
  }
  return Array.from(categories.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

function normalize(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function truncate(value, max) {
  const text = String(value || "");
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function quickReply(label, id) {
  return proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowButton.create({
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({ display_text: truncate(label, 20), id })
  });
}

function pagedOptions(entries, page, itemId, pageId) {
  if (entries.length <= 3) return entries.map((entry) => ({ label: entry.label, id: itemId(entry.value) }));
  const lastPage = entries.length - 3;
  const current = Math.min(Math.max(0, page), lastPage);
  if (current === 0) {
    return entries.slice(0, 2).map((entry) => ({ label: entry.label, id: itemId(entry.value) }))
      .concat([{ label: "Siguiente ▶", id: pageId(1) }]);
  }
  if (current === lastPage) {
    return [{ label: "◀ Anterior", id: pageId(current - 1) }]
      .concat(entries.slice(-2).map((entry) => ({ label: entry.label, id: itemId(entry.value) })));
  }
  return [
    { label: "◀ Anterior", id: pageId(current - 1) },
    { label: entries[current + 1].label, id: itemId(entries[current + 1].value) },
    { label: "Siguiente ▶", id: pageId(current + 1) }
  ];
}

async function sendNativeMenu(sock, jid, title, body, footer, options) {
  const buttons = options.map((option) => quickReply(option.label, option.id));
  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: proto.Message.InteractiveMessage.Header.create({ title, subtitle: "Menú de comandos" }),
    body: proto.Message.InteractiveMessage.Body.create({ text: body }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons,
      messageVersion: 0
    })
  });
  const content = proto.Message.create({
    messageContextInfo: proto.MessageContextInfo.create({
      deviceListMetadata: { senderTimestamp: String(Math.floor(Date.now() / 1000)) },
      deviceListMetadataVersion: 2
    }),
    viewOnceMessage: proto.Message.FutureProofMessage.create({
      message: proto.Message.create({ interactiveMessage })
    })
  });
  const generated = generateWAMessageFromContent(jid, content, { userJid: sock.user && sock.user.id });
  await sock.relayMessage(jid, generated.message, { messageId: generated.key.id });
}

function fallbackText(title, intro, entries, prefix, backCommand) {
  const lines = entries.map((entry) => "• " + entry.label + (entry.description ? " — " + entry.description : ""));
  return "*" + title + "*\n" + intro + "\n\n" + lines.join("\n") +
    "\n\nPara volver: " + prefix + backCommand;
}

export default {
  name: "menu2",
  aliases: [],
  category: "main",
  description: "Menú interactivo con botones nativos de WhatsApp.",

  async execute({ client, message, args, config, sock, commandPrefix }) {
    const prefix = commandPrefix || config.prefix || "!";
    const categories = getCategories(client);
    const allCommands = getCommands(client);
    const isCategoryAction = args[0] === "cat";
    const rawCategory = isCategoryAction ? decodeURIComponent(args[1] || "") : args.join(" ");
    const category = rawCategory && args[0] !== "page"
      ? categories.find(([name]) => normalize(name) === normalize(rawCategory))
      : null;
    let title;
    let intro;
    let entries;
    let page;
    let options;
    let backCommand;

    if (category) {
      const categoryName = category[0];
      const categoryCommands = category[1];
      page = isCategoryAction ? Math.max(0, Number.parseInt(args[2] || "0", 10) || 0) : 0;
      title = "Categoría: " + categoryName;
      intro = categoryDescriptions[categoryName] || "Pulsa un comando para ejecutarlo.";
      entries = categoryCommands.map((command) => ({
        label: prefix + command.name,
        description: command.description || "",
        value: command
      }));
      backCommand = "menu2";
      options = pagedOptions(
        entries,
        page,
        (command) => prefix + command.name,
        (nextPage) => prefix + "menu2 cat " + encodeURIComponent(categoryName) + " " + nextPage
      );
      if (options.length === 0) options = [{ label: "Volver", id: prefix + "menu2" }];
    } else {
      page = args[0] === "page" ? Math.max(0, Number.parseInt(args[1] || "0", 10) || 0) : 0;
      title = "Ghost Bot";
      intro = "Hay " + allCommands.length + " comandos. Pulsa una categoría para ver sus opciones.";
      entries = categories.map(([name, categoryCommands]) => ({
        label: name,
        description: categoryCommands.length + " comandos",
        value: name
      }));
      backCommand = "menu2";
      options = pagedOptions(
        entries,
        page,
        (name) => prefix + "menu2 cat " + encodeURIComponent(name) + " 0",
        (nextPage) => prefix + "menu2 page " + nextPage
      );
      if (options.length === 0) options = [{ label: "Ver menú", id: prefix + "menu" }];
    }

    const visibleEntries = entries.length <= 3
      ? entries
      : page === 0
        ? entries.slice(0, 2)
        : page >= entries.length - 3
          ? entries.slice(-2)
          : [entries[page + 1]];
    try {
      await sendNativeMenu(
        sock,
        message.from,
        title,
        intro,
        "Toca un botón • " + prefix + "menu2",
        options
      );
    } catch (error) {
      console.warn("No se pudo enviar el menú nativo; se usará texto:", error.message);
      await message.reply(fallbackText(title, intro, visibleEntries, prefix, backCommand));
    }
  }
};