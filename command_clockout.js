import { SlashCommandBuilder } from "discord.js";
import { statements } from "./database.js";
import { errorEmbed, successEmbed } from "./util_embeds.js";
import { calculateShiftPaidSeconds, formatDuration } from "./util_time.js";

export const data = new SlashCommandBuilder()
  .setName("clockout")
  .setDescription("End your current staff shift.");

export async function execute(interaction) {
  const shift = await statements.getActiveShift(interaction.guildId, interaction.user.id);
  if (!shift) {
    return interaction.reply({
      embeds: [errorEmbed("No active shift", "You are not currently clocked in.")],
      ephemeral: true
    });
  }

  const activeBreak = await statements.getActiveBreak(shift.id);
  if (activeBreak) {
    return interaction.reply({
      embeds: [errorEmbed("Break still active", "End your break with `/endbreak` before ending your shift.")],
      ephemeral: true
    });
  }

  const now = Date.now();
  const breaks = await statements.getBreaksForShift(shift.id);
  const paidSeconds = calculateShiftPaidSeconds({ ...shift, ended_at: now }, breaks, now);

  await statements.endShift(now, shift.id);

  return interaction.reply({
    embeds: [successEmbed(
      "Shift Ended",
      `Your shift has ended.\n\n**Paid time:** ${formatDuration(paidSeconds)}`
    )],
    ephemeral: true
  });
}
