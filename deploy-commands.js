import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import {
  REST,
  Routes
} from "discord.js";

const commands = [];

const projectDir = process.cwd();

for (
  const entry of fs.readdirSync(
    projectDir,
    {
      withFileTypes: true
    }
  )
) {
  // Only actual files
  if (!entry.isFile()) continue;

  // Only our command files
  if (
    !entry.name.startsWith("command_") ||
    !entry.name.endsWith(".js")
  ) {
    continue;
  }

  const fullPath = path.join(
    projectDir,
    entry.name
  );

  const command = await import(
    `file://${fullPath}`
  );

  if (command.data?.name) {
    commands.push(
      command.data.toJSON()
    );

    console.log(
      `[DEPLOY] Found /${command.data.name}`
    );
  }
}

if (!process.env.DISCORD_TOKEN) {
  throw new Error(
    "Missing DISCORD_TOKEN environment variable."
  );
}

if (!process.env.CLIENT_ID) {
  throw new Error(
    "Missing CLIENT_ID environment variable."
  );
}

const rest = new REST({
  version: "10"
}).setToken(
  process.env.DISCORD_TOKEN
);

if (process.env.GUILD_ID) {

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    {
      body: commands
    }
  );

  console.log(
    `[DEPLOY] Registered ${commands.length} guild command(s).`
  );

} else {

  await rest.put(
    Routes.applicationCommands(
      process.env.CLIENT_ID
    ),
    {
      body: commands
    }
  );

  console.log(
    `[DEPLOY] Registered ${commands.length} global command(s).`
  );
}