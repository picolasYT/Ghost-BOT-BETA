import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function trimOutput(text = "", maxLength = 1200) {
  const normalized = String(text || "").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

async function runCommand(command, args) {
  return await execFileAsync(command, args, {
    cwd: repoRoot,
    windowsHide: true
  });
}

async function runGit(args) {
  return await runCommand("git", args);
}

async function runNpmInstall() {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  return await runCommand(npmCmd, ["install"]);
}

async function detectBranch() {
  try {
    const { stdout } = await runGit(["branch", "--show-current"]);
    const branch = stdout.trim();
    if (branch) return branch;
  } catch {}

  try {
    const { stdout } = await runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
    const branch = stdout.trim();
    if (branch && branch !== "HEAD") return branch;
  } catch {}

  return "main";
}

async function detectRemoteUrl(fallbackRepoUrl) {
  try {
    const { stdout } = await runGit(["config", "--get", "remote.origin.url"]);
    const url = stdout.trim();
    if (url) return url;
  } catch {}

  return fallbackRepoUrl;
}

export default {
  name: "update",
  aliases: ["actualizar", "gitpull"],
  category: "system",
  description: "Actualiza el bot, instala cambios y reinicia. Solo owner.",

  async execute({ message, config }) {
    if (!message.fromMe) {
      return await message.reply("Solo el owner puede actualizar el bot desde su propia cuenta.");
    }

    await message.reply("⏳ Actualizando bot, instalando cambios y preparando reinicio...");

    try {
      const branch = await detectBranch();
      const remoteUrl = await detectRemoteUrl(config.repoUrl);

      const fetchResult = await runGit(["fetch", remoteUrl, branch]);
      await runGit(["reset", "--hard", "FETCH_HEAD"]);
      const installResult = await runNpmInstall();

      const output = trimOutput(
        [fetchResult.stdout, fetchResult.stderr, installResult.stdout, installResult.stderr]
          .filter(Boolean)
          .join("\n")
      );

      await message.reply(
        output
          ? `✅ Update completado.\n\n${output}\n\n♻️ Reiniciando bot...`
          : "✅ Update completado.\n\n♻️ Reiniciando bot..."
      );

      setTimeout(() => {
        process.exit(0);
      }, 1500);
    } catch (error) {
      const stdout = trimOutput(error?.stdout || "");
      const stderr = trimOutput(error?.stderr || "");
      const detail = trimOutput(stderr || stdout || error?.message || "Sin detalle.");

      await message.reply(`❌ No pude actualizar el bot.\n\n${detail}`);
    }
  }
};
