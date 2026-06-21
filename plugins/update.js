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

async function runGit(args) {
  return await execFileAsync("git", args, {
    cwd: repoRoot,
    windowsHide: true
  });
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

async function hasLocalChanges() {
  const { stdout } = await runGit(["status", "--porcelain"]);
  return Boolean(stdout.trim());
}

export default {
  name: "update",
  aliases: ["actualizar", "gitpull"],
  category: "system",
  description: "Actualiza el bot haciendo git pull. Solo owner.",

  async execute({ message, config, reloadCommands }) {
    if (!message.fromMe) {
      return await message.reply("Solo el owner puede actualizar el bot desde su propia cuenta.");
    }

    await message.reply("⏳ Buscando actualizaciones del bot...");

    try {
      if (await hasLocalChanges()) {
        return await message.reply(
          "⚠️ No hice update porque hay cambios locales sin subir en el servidor. Hacé commit o limpiá esos cambios primero."
        );
      }

      const branch = await detectBranch();
      const remoteUrl = await detectRemoteUrl(config.repoUrl);

      await runGit(["fetch", remoteUrl, branch]);
      const result = await runGit(["pull", "--ff-only", remoteUrl, branch]);

      const output = trimOutput([result.stdout, result.stderr].filter(Boolean).join("\n"));
      const updated = !/already up to date/i.test(output);

      let reloadText = "";
      if (updated && typeof reloadCommands === "function") {
        const total = await reloadCommands();
        reloadText = `\n\nPlugins recargados: ${total}`;
      }

      await message.reply(
        output
          ? `✅ Update completado.\n\n${output}${reloadText}`
          : `✅ Update completado.${reloadText}`
      );
    } catch (error) {
      const stdout = trimOutput(error?.stdout || "");
      const stderr = trimOutput(error?.stderr || "");
      const detail = trimOutput(stderr || stdout || error?.message || "Sin detalle.");

      await message.reply(`❌ No pude actualizar el bot.\n\n${detail}`);
    }
  }
};
