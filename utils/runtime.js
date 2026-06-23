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

export function buildRuntimeSummary(runtime, config, commandsSize) {
  const authPath = resolveAuthPath(config.authPath);

  return [
    `Bot: ${config.botName}`,
    `Provider: ${config.provider}`,
    `Plataforma: ${runtime.platform}/${runtime.arch}${runtime.isTermux ? " (termux)" : ""}`,
    `Node: ${runtime.node}`,
    `Prefijo: ${config.prefix}`,
    `Comandos: ${commandsSize}`,
    `Auth: ${authPath}`
  ].join("\n");
}

export function getStartupHints(runtime, config) {
  const hints = [];

  if (runtime.isTermux) {
    hints.push(
      "Termux detectado: usa Node 20+ para mantener compatibilidad con Baileys."
    );
  }

  return hints;
}
