import { SlashCommandBuilder } from "discord.js";
import { statements } from "./database.js";
import { successEmbed, errorEmbed } from "./util_embeds.js";

export const data = new SlashCommandBuilder()
  .setName("clockin")
  .setDescription("Start your staff shift.");

export async function execute(interaction) {
  const active = await statements.getActiveShift(interaction.guildId, interaction.user.id);
  if (active) {
    return interaction.reply({
      embeds: [errorEmbed("Already clocked in", "You already have an active shift.")],
      ephemeral: true
    });
  }

  const now = Date.now();
  await statements.startShift(interaction.guildId, interaction.user.id, now);

  return interaction.reply({
    embeds: [successEmbed("Shift Started", `You are now clocked in.\nStarted <t:${Math.floor(now / 1000)}:R>.`)],
    ephemeral: true
  });
}
