import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

export async function loadPlugins() {
  const commands = new Map();
  const pluginsDir = path.resolve("./plugins");

  if (!fs.existsSync(pluginsDir)) {
    console.log("⚠️ La carpeta plugins no existe.");
    return commands;
  }

  const files = fs.readdirSync(pluginsDir).filter(file => file.endsWith(".js"));

  for (const file of files) {
    const fullPath = path.join(pluginsDir, file);

    try {
      const module = await import(pathToFileURL(fullPath).href);
      const command = module.default;

      if (!command?.name || !command?.execute) {
        console.log(`⚠️ Plugin inválido: ${file}`);
        continue;
      }

      commands.set(command.name.toLowerCase(), command);
      console.log(`✅ Plugin cargado: ${command.name}`);
    } catch (error) {
      console.log(`❌ Error cargando plugin ${file}: ${error.message}`);
    }
  }

  return commands;
}