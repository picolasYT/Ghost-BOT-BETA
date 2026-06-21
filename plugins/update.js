import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

function trimOutput(text = "", maxLength = 1200) {
  const normalized = String(text || "").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

async function runGit(args) {
  return await execFileAsync("git", args, {
    cwd: process.cwd(),
    windowsHide: true
  });
}

async function detectPullTarget() {
  try {
    const { stdout } = await runGit(["branch", "--show-current"]);
    const branch = stdout.trim();

    if (branch) {
      return ["pull", "origin", branch];
    }
  } catch {}

  try {
    const { stdout } = await runGit(["symbolic-ref", "refs/remotes/origin/HEAD"]);
    const remoteHead = stdout.trim();
    const branch = remoteHead.split("/").pop();

    if (branch) {
      return ["pull", "origin", branch];
    }
  } catch {}

  return ["pull", "origin", "main"];
}

export default {
  name: "update",
  aliases: ["actualizar", "gitpull"],
  category: "system",
  description: "Actualiza el bot haciendo git pull. Solo owner.",

  async execute({ message }) {
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

        if (!detail.includes("not currently on a branch")) {
          throw error;
        }

        const fallbackArgs = await detectPullTarget();
        result = await runGit(fallbackArgs);
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
