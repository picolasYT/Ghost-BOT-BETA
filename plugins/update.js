import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

function trimOutput(text = "", maxLength = 1200) {
  const normalized = String(text || "").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
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

    await message.reply("⏳ Ejecutando git pull...");

    try {
      const { stdout, stderr } = await execFileAsync("git", ["pull"], {
        cwd: process.cwd(),
        windowsHide: true
      });

      const output = trimOutput([stdout, stderr].filter(Boolean).join("\n"));

      await message.reply(
        output
          ? `✅ Actualizacion completada.\n\n${output}`
          : "✅ Actualizacion completada."
      );
    } catch (error) {
      const stdout = trimOutput(error?.stdout || "");
      const stderr = trimOutput(error?.stderr || "");
      const detail = trimOutput(stderr || stdout || error?.message || "Sin detalle.");

      await message.reply(`❌ No pude ejecutar git pull.\n\n${detail}`);
    }
  }
};
