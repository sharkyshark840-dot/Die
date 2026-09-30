import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder
} from "discord.js";
import { statements } from "./database.js";
import { infoEmbed } from "./util_embeds.js";
import { formatDuration } from "./util_time.js";

const PAGE_SIZE = 5;
const LEADERBOARD_TIMEOUT = 5 * 60 * 1000;

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("View the read-only staff paid-time leaderboard.");

function buildLeaderboardEmbed(leaderboard, page) {
  const totalPages = Math.max(1, Math.ceil(leaderboard.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const entries = leaderboard.slice(start, start + PAGE_SIZE);

  const lines = entries.map((entry, index) => {
    const position = start + index + 1;
    return `**${position}.** <@${entry.user_id}> — **${formatDuration(entry.total_seconds)}**`;
  });

  return infoEmbed(
    "🏆 Staff Leaderboard",
    lines.join("\n")
  ).setFooter({
    text: `Page ${page + 1} of ${totalPages} • Read-only`
  });
}

function buildLeaderboardButtons(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("leaderboard_previous")
      .setLabel("Previous")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId("leaderboard_next")
      .setLabel("Next")
      .setEmoji("▶️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1)
  );
}

function disableLeaderboardButtons(row) {
  return new ActionRowBuilder().addComponents(
    ...row.components.map(component =>
      ButtonBuilder.from(component).setDisabled(true)
    )
  );
}

async function showLeaderboard(interaction, { ephemeral = false } = {}) {
  const leaderboard = await statements.getLeaderboard(interaction.guildId, 1000);

  if (!leaderboard.length) {
    return interaction.reply({
      embeds: [infoEmbed("🏆 Staff Leaderboard", "No recorded staff time yet.")],
      ephemeral
    });
  }

  let page = 0;
  const totalPages = Math.ceil(leaderboard.length / PAGE_SIZE);
  const components = [buildLeaderboardButtons(page, totalPages)];

  const message = await interaction.reply({
    embeds: [buildLeaderboardEmbed(leaderboard, page)],
    components,
    ephemeral,
    fetchReply: true
  });

  const collector = message.createMessageComponentCollector({
    time: LEADERBOARD_TIMEOUT
  });

  collector.on("collect", async buttonInteraction => {
    if (buttonInteraction.user.id !== interaction.user.id) {
      return buttonInteraction.reply({
        content: "❌ Only the person who opened this leaderboard can use the navigation buttons.",
        ephemeral: true
      });
    }

    if (buttonInteraction.customId === "leaderboard_previous" && page > 0) {
      page -= 1;
    }

    if (buttonInteraction.customId === "leaderboard_next" && page < totalPages - 1) {
      page += 1;
    }

    await buttonInteraction.update({
      embeds: [buildLeaderboardEmbed(leaderboard, page)],
      components: [buildLeaderboardButtons(page, totalPages)]
    });
  });

  collector.on("end", async () => {
    try {
      await message.edit({
        components: [disableLeaderboardButtons(buildLeaderboardButtons(page, totalPages))]
      });
    } catch {
      // The message may have been deleted or become unavailable.
    }
  });
}

export async function execute(interaction) {
  return showLeaderboard(interaction, { ephemeral: false });
}

export async function showLeaderboardFromPanel(interaction) {
  return showLeaderboard(interaction, { ephemeral: true });
}
