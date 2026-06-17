export default {
  prefix: process.env.PREFIX || "!",
  botName: process.env.BOT_NAME || "Ghost-Bot",
  ownerName: process.env.OWNER_NAME || "Picolas",

  // Método de autenticación. Puede ser "qr" (por defecto) o "code" para
  // emparejar mediante código numérico. Si usás "code" debés proporcionar
  // un número de teléfono en formato internacional (sin símbolos, por ejemplo
  // 549123456789 para Argentina). Estos valores también pueden establecerse
  // mediante variables de entorno LOGIN_METHOD y PHONE_NUMBER.
  loginMethod: process.env.LOGIN_METHOD || "qr",

  // Número de teléfono utilizado para la autenticación por código. Solo se
  // utiliza cuando loginMethod es "code". Debe ser una cadena compuesta
  // únicamente por dígitos.
  phoneNumber: process.env.PHONE_NUMBER || ""
};