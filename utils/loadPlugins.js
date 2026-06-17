import fs from "fs";
import path from "path";
import { pathToFileURL, fileURLToPath } from "url";

export async function loadPlugins() {
  const commands = new Map();
  // Calculamos la ruta de la carpeta plugins de forma relativa a este archivo
  // para evitar problemas cuando el proceso se ejecuta desde otro directorio.
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const pluginsDir = path.join(__dirname, "..", "plugins");

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

      // 🔍 Validación
      if (!command?.name || !command?.execute) {
        console.log(`⚠️ Plugin inválido: ${file}`);
        continue;
      }

      // 🔥 SOPORTE DE ALIASES
      // Siempre incluimos el nombre del comando original junto con sus alias.
      const aliases = Array.isArray(command.aliases) ? command.aliases : [];
      const names = [command.name, ...aliases];

      for (const name of names) {
        if (typeof name === "string") {
          commands.set(name.toLowerCase(), command);
        }
      }

      console.log(`✅ Plugin cargado: ${command.name} (${names.join(", ")})`);

    } catch (error) {
      console.log(`❌ Error cargando plugin ${file}: ${error.message}`);
    }
  }

  return commands;
}