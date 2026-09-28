import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { initDatabase } from "./database.js";
import {
  Client,
  Collection,
  GatewayIntentBits,
  Events
} from "discord.js";

if (!process.env.DISCORD_TOKEN) {
  throw new Error("Missing DISCORD_TOKEN environment variable.");
}
if (!process.env.CLIENT_ID) {
  throw new Error("Missing CLIENT_ID environment variable.");
}

await initDatabase();
console.log("[STARTUP] PostgreSQL database initialized.");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();

const commandsDir = process.cwd();

// Commands live in the project root. Do NOT recursively scan the whole app
// directory because that also walks through node_modules and can prevent the
// bot from ever reaching client.login().
async function loadCommands(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.startsWith("command_") || !entry.name.endsWith(".js")) continue;

    const fullPath = path.join(dir, entry.name);
    const command = await import(`file://${fullPath}`);

    if (command.data?.name && command.execute) {
      client.commands.set(command.data.name, command);
      console.log(`[STARTUP] Loaded /${command.data.name}`);
    }
  }
}

await loadCommands(commandsDir);

client.once(Events.ClientReady, readyClient => {
  console.log(`[READY] Logged in as ${readyClient.user.tag}`);
  console.log(`[READY] Serving ${readyClient.guilds.cache.size} guild(s).`);
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isRoleSelectMenu() && interaction.customId === "setup_admin_role") {
      const setup = client.commands.get("setup");
      return await setup.handleSetupRoleSelect(interaction);
    }

    if (interaction.isButton() && interaction.customId.startsWith("staff_")) {
      const panel = client.commands.get("panel");
      if (!panel?.handleButton) return;
      return await panel.handleButton(interaction);
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    await command.execute(interaction);
  } catch (error) {
    console.error("[INTERACTION ERROR]", error);

    const payload = {
      content: "⚠️ Something went wrong while processing that action. Please try again.",
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.on(Events.Error, error => {
  console.error("[DISCORD ERROR]", error);
});

async function shutdown(signal) {
  console.log(`[SHUTDOWN] Received ${signal}.`);
  client.destroy();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await client.login(process.env.DISCORD_TOKEN);
