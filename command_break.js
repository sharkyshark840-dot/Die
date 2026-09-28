import { SlashCommandBuilder } from "discord.js";
import { statements } from "./database.js";
import { errorEmbed, successEmbed } from "./util_embeds.js";

export const data = new SlashCommandBuilder()
  .setName("break")
  .setDescription("Start your staff break.");

export async function execute(interaction) {
  const shift = await statements.getActiveShift(interaction.guildId, interaction.user.id);
  if (!shift) {
    return interaction.reply({
      embeds: [errorEmbed("No active shift", "Clock in before starting a break.")],
      ephemeral: true
    });
  }

  const activeBreak = await statements.getActiveBreak(shift.id);
  if (activeBreak) {
    return interaction.reply({
      embeds: [errorEmbed("Already on break", "You already have an active break.")],
      ephemeral: true
    });
  }

  const now = Date.now();
  await statements.startBreak(shift.id, now);

  return interaction.reply({
    embeds: [successEmbed("Break Started", `Your break started <t:${Math.floor(now / 1000)}:R>.`)],
    ephemeral: true
  });
}
