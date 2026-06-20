import os from "os";
import path from "path";

export function detectRuntime() {
  const isWindows = process.platform === "win32";
  const isLinux = process.platform === "linux";
  const isMac = process.platform === "darwin";
  const isTermux =
    Boolean(process.env.TERMUX_VERSION) ||
    process.env.PREFIX?.includes("com.termux") ||
    false;

  return {
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    node: process.version,
    isWindows,
    isLinux,
    isMac,
    isTermux
  };
}

export function resolveAuthPath(authPath) {
  return path.resolve(authPath || "./data/auth");
}

export function shouldDisableSandbox(runtime, configuredValue) {
  if (configuredValue === "true") return true;
  if (configuredValue === "false") return false;

  return runtime.isLinux || runtime.isTermux;
}

export function buildChromiumArgs(runtime, disableSandbox) {
  const args = [
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check"
  ];

  if (disableSandbox) {
    args.push("--no-sandbox", "--disable-setuid-sandbox");
  }

  if (runtime.isTermux) {
    args.push("--single-process", "--disable-features=site-per-process");
  }

  return args;
}

export function buildRuntimeSummary(runtime, config, commandsSize) {
  const authPath = resolveAuthPath(config.authPath);

  return [
    `Bot: ${config.botName}`,
    `Provider: ${config.provider}`,
    `Plataforma: ${runtime.platform}/${runtime.arch}${runtime.isTermux ? " (termux)" : ""}`,
    `Node: ${runtime.node}`,
    `Prefijo: ${config.prefix}`,
    `Comandos: ${commandsSize}`,
    `Auth: ${authPath}`,
    `Chrome: ${config.chromePath || "auto"}`
  ].join("\n");
}

export function getStartupHints(runtime, config) {
  const hints = [];

  if (config.provider !== "whatsapp-web.js") {
    hints.push(
      `Proveedor "${config.provider}" no soportado todavia. Se usara whatsapp-web.js.`
    );
  }

  if (runtime.isTermux && !config.chromePath) {
    hints.push(
      "Termux detectado: defini CHROME_PATH si Chromium no se encuentra automaticamente."
    );
  }

  if ((runtime.isLinux || runtime.isTermux) && config.disableSandbox === "false") {
    hints.push(
      "Sandbox del navegador desactivado manualmente: si el bot no inicia, proba DISABLE_SANDBOX=auto."
    );
  }

  return hints;
}
