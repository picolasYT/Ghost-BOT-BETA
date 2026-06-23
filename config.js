export default {
  prefix: process.env.PREFIX || "!",
  botName: process.env.BOT_NAME || "Ghost-Bot",
  ownerName: process.env.OWNER_NAME || "Picolas",
  ownerNumber: process.env.OWNER_NUMBER || process.env.PHONE_NUMBER || "",
  provider: "baileys",
  repoUrl: process.env.REPO_URL || "https://github.com/picolasYT/Ghost-BOT-BETA.git",
  webPort: Number(process.env.PORT || process.env.WEB_PORT || 3000),
  webHost: process.env.WEB_HOST || "0.0.0.0",
  authPath: process.env.AUTH_PATH || "./data/auth",

  // Metodo de autenticacion. Puede ser "qr" o "code".
  loginMethod: process.env.LOGIN_METHOD || "qr",

  // Numero usado en el emparejamiento por codigo.
  phoneNumber: process.env.PHONE_NUMBER || ""
};
