import fs from "fs";
import os from "os";
import path from "path";
import { spawn, spawnSync } from "child_process";

function findBinary(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate.includes(path.sep) && fs.existsSync(candidate)) return candidate;
    if (!candidate.includes(path.sep)) {
      const probe = spawnSync(process.platform === "win32" ? "where" : "which", [candidate], {
        windowsHide: true,
        encoding: "utf8"
      });

      if (probe.status === 0) {
        const first = probe.stdout.split(/\r?\n/).find(Boolean);
        if (first) return first.trim();
      }
    }
  }

  return null;
}

export function getYtDlpBinary() {
  return findBinary([
    process.env.YT_DLP_PATH,
    path.resolve("./bin/yt-dlp.exe"),
    path.resolve("./bin/yt-dlp"),
    path.join(
      process.env.LOCALAPPDATA || "",
      "Microsoft",
      "WinGet",
      "Links",
      "yt-dlp.exe"
    ),
    path.join(
      process.env.LOCALAPPDATA || "",
      "Microsoft",
      "WinGet",
      "Packages",
      "yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe",
      "yt-dlp.exe"
    ),
    "yt-dlp"
  ]);
}

export function hasYtDlp() {
  return Boolean(getYtDlpBinary());
}

function runCommand(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(stderr.trim() || `yt-dlp finalizo con codigo ${code}`));
    });
  });
}

export async function getYtDlpInfo(url) {
  const binary = getYtDlpBinary();
  if (!binary) throw new Error("yt-dlp no esta instalado.");

  const { stdout } = await runCommand(binary, [
    "--dump-single-json",
    "--no-playlist",
    url
  ]);

  return JSON.parse(stdout);
}

export async function downloadWithYtDlp(url, mode = "video") {
  const binary = getYtDlpBinary();
  if (!binary) throw new Error("yt-dlp no esta instalado.");

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ghost-ytdlp-"));
  const outputTemplate = path.join(tmpDir, "%(title).80s.%(ext)s");
  const args =
    mode === "audio"
      ? [
          "-f",
          "bestaudio",
          "-x",
          "--audio-format",
          "mp3",
          "--audio-quality",
          "0",
          "--no-playlist",
          "-o",
          outputTemplate,
          url
        ]
      : [
          "-f",
          "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
          "--merge-output-format",
          "mp4",
          "--no-playlist",
          "-o",
          outputTemplate,
          url
        ];

  try {
    await runCommand(binary, args);

    const files = fs.readdirSync(tmpDir);
    const file = files[0];

    if (!file) {
      throw new Error("yt-dlp no genero ningun archivo.");
    }

    const fullPath = path.join(tmpDir, file);
    const buffer = fs.readFileSync(fullPath);
    const title = path.parse(fullPath).name;
    const ext = path.extname(fullPath).slice(1).toLowerCase();

    return {
      buffer,
      title,
      ext
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
