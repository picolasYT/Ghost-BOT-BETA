import fs from "fs";
import path from "path";
import { pathToFileURL, fileURLToPath } from "url";

export async function loadPlugins() {
  const commands = new Map();
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const pluginsDir = path.join(__dirname, "..", "plugins");

  if (!fs.existsSync(pluginsDir)) {
    console.log("La carpeta plugins no existe.");
    return commands;
  }

  const files = fs.readdirSync(pluginsDir).filter((file) => file.endsWith(".js"));

  for (const file of files) {
    const fullPath = path.join(pluginsDir, file);

    try {
      const cacheKey = fs.statSync(fullPath).mtimeMs;
      const moduleUrl = `${pathToFileURL(fullPath).href}?v=${cacheKey}`;
      const module = await import(moduleUrl);
      const command = module.default;

      if (!command?.name || !command?.execute) {
        console.log(`Plugin invalido: ${file}`);
        continue;
      }

      const aliases = Array.isArray(command.aliases) ? command.aliases : [];
      const names = [command.name, ...aliases];

      for (const name of names) {
        if (typeof name === "string") {
          commands.set(name.toLowerCase(), command);
        }
      }

      console.log(`Plugin cargado: ${command.name} (${names.join(", ")})`);
    } catch (error) {
      console.log(`Error cargando plugin ${file}: ${error.message}`);
    }
  }

  return commands;
}
