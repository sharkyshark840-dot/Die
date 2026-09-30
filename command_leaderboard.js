import { SlashCommandBuilder } from "discord.js";
import { statements } from "./database.js";
import { infoEmbed } from "./util_embeds.js";
import { formatDuration } from "./util_time.js";

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("View the staff paid-time leaderboard.");

export async function execute(interaction) {
  const leaderboard = await statements.getLeaderboard(interaction.guildId, 10);

  if (!leaderboard.length) {
    return interaction.reply({
      embeds: [infoEmbed("🏆 Staff Leaderboard", "No recorded staff time yet.")],
      ephemeral: false
    });
  }

  const lines = leaderboard.map((entry, index) =>
    `**${index + 1}.** <@${entry.user_id}> — **${formatDuration(entry.total_seconds)}**`
  );

  return interaction.reply({
    embeds: [infoEmbed("🏆 Staff Leaderboard", lines.join("\n"))],
    ephemeral: false
  });
}
