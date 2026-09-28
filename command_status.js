import { SlashCommandBuilder } from "discord.js";
import { statements } from "./database.js";
import { errorEmbed, infoEmbed } from "./util_embeds.js";
import { calculateShiftPaidSeconds, formatDuration } from "./util_time.js";

export const data = new SlashCommandBuilder()
  .setName("status")
  .setDescription("View your current staff time status.");

export async function execute(interaction) {
  const shift = await statements.getActiveShift(interaction.guildId, interaction.user.id);

  if (!shift) {
    return interaction.reply({
      embeds: [infoEmbed("Staff Status", "🔴 You are currently **off shift**.")],
      ephemeral: true
    });
  }

  const activeBreak = await statements.getActiveBreak(shift.id);
  const breaks = await statements.getBreaksForShift(shift.id);
  const paidSeconds = calculateShiftPaidSeconds(shift, breaks);

  return interaction.reply({
    embeds: [infoEmbed(
      "Staff Status",
      [
        activeBreak ? "🟡 **On break**" : "🟢 **Clocked in**",
        `Shift started: <t:${Math.floor(shift.started_at / 1000)}:f>`,
        `Paid time so far: **${formatDuration(paidSeconds)}**`,
        activeBreak ? `Break started: <t:${Math.floor(activeBreak.started_at / 1000)}:R>` : ""
      ].filter(Boolean).join("\n")
    )],
    ephemeral: true
  });
}
