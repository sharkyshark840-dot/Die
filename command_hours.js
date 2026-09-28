import { SlashCommandBuilder } from "discord.js";
import { statements } from "./database.js";
import { calculateShiftPaidSeconds, formatDuration } from "./util_time.js";

export const data = new SlashCommandBuilder()
  .setName("hours")
  .setDescription("View your recorded paid time.");

export async function execute(interaction) {
  const shifts = await statements.getCompletedShifts(interaction.guildId, interaction.user.id, 100);
  const active = await statements.getActiveShift(interaction.guildId, interaction.user.id);
  const adjustments = await statements.getAdjustments(interaction.guildId, interaction.user.id, 1000);

  let total = 0;

  for (const shift of shifts) {
    total += calculateShiftPaidSeconds(
      shift,
      await statements.getBreaksForShift(shift.id)
    );
  }

  if (active) {
    total += calculateShiftPaidSeconds(
      active,
      await statements.getBreaksForShift(active.id)
    );
  }

  const adjustmentSeconds = adjustments.reduce(
    (sum, row) => sum + row.amount_seconds,
    0
  );

  const finalTotal = Math.max(0, total + adjustmentSeconds);

  return interaction.reply({
    content: [
      `📊 **Your recorded paid time:** ${formatDuration(finalTotal)}`,
      `• Shift time: **${formatDuration(total)}**`,
      `• Manual adjustments: **${adjustmentSeconds >= 0 ? "+" : "-"}${formatDuration(Math.abs(adjustmentSeconds))}**`
    ].join("\n"),
    ephemeral: true
  });
}
