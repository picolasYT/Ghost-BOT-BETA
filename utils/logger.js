const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  white: "\x1b[37m"
};

function colorize(color, text) {
  return `${COLORS[color] || ""}${text}${COLORS.reset}`;
}

function timestamp() {
  return new Date().toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function print(label, color, message) {
  console.log(
    `${colorize("dim", `[${timestamp()}]`)} ${colorize(color, label)} ${message}`
  );
}

export function logInfo(message) {
  print("INFO ", "cyan", message);
}

export function logStep(message) {
  print("STEP ", "blue", message);
}

export function logSuccess(message) {
  print(" OK  ", "green", message);
}

export function logWarn(message) {
  print("WARN ", "yellow", message);
}

export function logError(message, error) {
  print("FAIL ", "red", message);
  if (error) {
    console.error(colorize("red", error.stack || error.message || String(error)));
  }
}

export function logBanner(lines) {
  const content = Array.isArray(lines) ? lines : [String(lines)];
  const width = Math.max(...content.map((line) => line.length), 24);
  const border = `╔${"═".repeat(width + 2)}╗`;
  const footer = `╚${"═".repeat(width + 2)}╝`;

  console.log(colorize("magenta", border));
  for (const line of content) {
    console.log(colorize("magenta", `║ ${line.padEnd(width)} ║`));
  }
  console.log(colorize("magenta", footer));
}

export function formatId(id = "") {
  if (!id) return "desconocido";
  return colorize("white", id);
}

export function installPrettyConsole() {
  const nativeWarn = console.warn.bind(console);
  const nativeError = console.error.bind(console);

  console.warn = (...args) => {
    const text = args.map((arg) => String(arg)).join(" ");

    if (/Could not parse decipher function/i.test(text)) {
      nativeWarn(
        `${colorize("dim", `[${timestamp()}]`)} ${colorize("yellow", "WARN ")} ytdl-core no pudo descifrar una firma de YouTube.`
      );
      return;
    }

    if (/Could not parse n transform function/i.test(text)) {
      nativeWarn(
        `${colorize("dim", `[${timestamp()}]`)} ${colorize("yellow", "WARN ")} ytdl-core no pudo transformar un parametro "n" de YouTube.`
      );
      return;
    }

    nativeWarn(`${colorize("dim", `[${timestamp()}]`)} ${colorize("yellow", "WARN ")} ${text}`);
  };

  console.error = (...args) => {
    const text = args
      .map((arg) => (arg instanceof Error ? arg.stack || arg.message : String(arg)))
      .join(" ");

    nativeError(`${colorize("dim", `[${timestamp()}]`)} ${colorize("red", "FAIL ")} ${text}`);
  };
}
