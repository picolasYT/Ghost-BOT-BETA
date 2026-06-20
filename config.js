export default {
  prefix: process.env.PREFIX || "!",
  botName: process.env.BOT_NAME || "Ghost-Bot",
  ownerName: process.env.OWNER_NAME || "Picolas",
  provider: process.env.PROVIDER || "whatsapp-web.js",
  authPath: process.env.AUTH_PATH || "./data/auth",
  chromePath:
    process.env.CHROME_PATH ||
    process.env.CHROMIUM_PATH ||
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    "",
  headless:
    (process.env.PUPPETEER_HEADLESS || "true").toLowerCase() !== "false",
  disableSandbox: (process.env.DISABLE_SANDBOX || "auto").toLowerCase(),

  // Metodo de autenticacion. Puede ser "qr" o "code".
  loginMethod: process.env.LOGIN_METHOD || "qr",

  // Numero usado en el emparejamiento por codigo.
  phoneNumber: process.env.PHONE_NUMBER || ""
};
