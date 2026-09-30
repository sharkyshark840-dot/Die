import { SlashCommandBuilder } from "discord.js";
import { statements } from "./database.js";
import { calculateShiftPaidSeconds, formatDuration } from "./util_time.js";

export const data = new SlashCommandBuilder()
  .setName("hours")
  .setDescription("View your recorded paid time.");

export async function execute(interaction) {
  const shifts = await statements.getCompletedShifts(interaction.guildId, interaction.user.id, 1000);
  const active = await statements.getActiveShift(interaction.guildId, interaction.user.id);
  const adjustments = await statements.getAdjustments(interaction.guildId, interaction.user.id, 1000);

  let shiftSeconds = 0;

  for (const shift of shifts) {
    shiftSeconds += calculateShiftPaidSeconds(
      shift,
      await statements.getBreaksForShift(shift.id)
    );
  }

  if (active) {
    shiftSeconds += calculateShiftPaidSeconds(
      active,
      await statements.getBreaksForShift(active.id)
    );
  }

  const adjustmentSeconds = adjustments.reduce(
    (sum, row) => sum + Number(row.amount_seconds),
    0
  );

  const totalSeconds = Math.max(0, shiftSeconds + adjustmentSeconds);

  return interaction.reply({
    content: [
      `📊 **Total:** ${formatDuration(totalSeconds)}`,
      `• Shift time: **${formatDuration(totalSeconds)}**`
    ].join("\n"),
    ephemeral: true
  });
}
