import { SlashCommandBuilder } from "discord.js";
import { statements } from "./database.js";
import { errorEmbed, successEmbed } from "./util_embeds.js";
import { formatDuration } from "./util_time.js";

export const data = new SlashCommandBuilder()
  .setName("endbreak")
  .setDescription("End your current staff break.");

export async function execute(interaction) {
  const shift = await statements.getActiveShift(interaction.guildId, interaction.user.id);
  if (!shift) {
    return interaction.reply({
      embeds: [errorEmbed("No active shift", "You do not have an active shift.")],
      ephemeral: true
    });
  }

  const activeBreak = await statements.getActiveBreak(shift.id);
  if (!activeBreak) {
    return interaction.reply({
      embeds: [errorEmbed("No active break", "You are not currently on break.")],
      ephemeral: true
    });
  }

  const now = Date.now();
  await statements.endBreak(now, activeBreak.id);

  return interaction.reply({
    embeds: [successEmbed(
      "Break Ended",
      `Break duration: **${formatDuration((now - activeBreak.started_at) / 1000)}**`
    )],
    ephemeral: true
  });
}
