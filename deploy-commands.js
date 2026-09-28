import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { REST, Routes } from "discord.js";

const commands = [];

async function loadCommands(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await loadCommands(fullPath);
      continue;
    }
    if (!entry.name.endsWith(".js") || entry.name === "index.js") continue;

    const command = await import(`file://${fullPath}`);
    if (command.data) commands.push(command.data.toJSON());
  }
}

await loadCommands(process.cwd());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

if (process.env.GUILD_ID) {
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );
  console.log(`[DEPLOY] Registered ${commands.length} guild command(s).`);
} else {
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );
  console.log(`[DEPLOY] Registered ${commands.length} global command(s).`);
}
