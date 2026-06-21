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
    const { stdout } = await runGit(["symbolic-ref", "refs/remotes/origin/HEAD"]);
    const branch = stdout.trim().split("/").pop();
    if (branch) return branch;
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
  description: "Actualiza el bot haciendo git pull. Solo owner.",

  async execute({ message, config }) {
    if (!message.fromMe) {
      return await message.reply("Solo el owner puede actualizar el bot desde su propia cuenta.");
    }

    await message.reply("⏳ Ejecutando actualizacion del bot...");

    try {
      let result;

      try {
        result = await runGit(["pull"]);
      } catch (error) {
        const detail = String(error?.stderr || error?.stdout || error?.message || "").toLowerCase();

        if (detail.includes("not currently on a branch")) {
          const branch = await detectBranch();
          const remoteUrl = await detectRemoteUrl(config.repoUrl);
          result = await runGit(["pull", remoteUrl, branch]);
        } else if (detail.includes("does not appear to be a git repository")) {
          const branch = await detectBranch();
          const remoteUrl = await detectRemoteUrl(config.repoUrl);
          result = await runGit(["pull", remoteUrl, branch]);
        } else {
          throw error;
        }
      }

      const output = trimOutput([result.stdout, result.stderr].filter(Boolean).join("\n"));

      await message.reply(
        output
          ? `✅ Actualizacion completada.\n\n${output}`
          : "✅ Actualizacion completada."
      );
    } catch (error) {
      const stdout = trimOutput(error?.stdout || "");
      const stderr = trimOutput(error?.stderr || "");
      const detail = trimOutput(stderr || stdout || error?.message || "Sin detalle.");

      await message.reply(`❌ No pude actualizar el bot.\n\n${detail}`);
    }
  }
};
