import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder
} from "discord.js";
import { statements } from "./database.js";
import { canManageStaff } from "./util_permissions.js";
import { errorEmbed, infoEmbed } from "./util_embeds.js";
import { calculateShiftPaidSeconds, formatDuration } from "./util_time.js";

const PANEL_BUTTONS = Object.freeze([
  {
    customId: "staff_clockin",
    label: "Clock In",
    emoji: "🟢",
    style: ButtonStyle.Success
  },
  {
    customId: "staff_break",
    label: "Start Break",
    emoji: "☕",
    style: ButtonStyle.Secondary
  },
  {
    customId: "staff_endbreak",
    label: "End Break",
    emoji: "🔵",
    style: ButtonStyle.Primary
  },
  {
    customId: "staff_clockout",
    label: "Clock Out",
    emoji: "🔴",
    style: ButtonStyle.Danger
  },
  {
    customId: "staff_hours",
    label: "My Hours",
    emoji: "📊",
    style: ButtonStyle.Secondary
  }
]);

export const data = new SlashCommandBuilder()
  .setName("panel")
  .setDescription("Post the Staff Time control panel.");

function panelComponents() {
  const row = new ActionRowBuilder();

  for (const button of PANEL_BUTTONS) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(button.customId)
        .setLabel(button.label)
        .setEmoji(button.emoji)
        .setStyle(button.style)
    );
  }

  return [row];
}

export function buildPanel() {
  const embed = new EmbedBuilder()
    .setTitle("Staff Time Management");

  return {
    embeds: [embed],
    components: panelComponents()
  };
}

export async function execute(interaction) {
  if (!(await canManageStaff(interaction))) {
    return interaction.reply({
      embeds: [errorEmbed(
        "Permission denied",
        "Only a Discord Administrator or the configured Staff Admin role can post the panel."
      )],
      ephemeral: true
    });
  }

  const message = await interaction.channel.send(buildPanel());

  return interaction.reply({
    content: `✅ Staff Time Panel posted: ${message.url}`,
    ephemeral: true
  });
}

export async function handleButton(interaction) {
  const { customId } = interaction;
  const shift = await statements.getActiveShift(interaction.guildId, interaction.user.id);

  if (customId === "staff_clockin") {
    if (shift) {
      return interaction.reply({
        embeds: [errorEmbed("Already clocked in", "You already have an active shift.")],
        ephemeral: true
      });
    }

    const now = Date.now();
    await statements.startShift(interaction.guildId, interaction.user.id, now);

    return interaction.reply({
      embeds: [infoEmbed(
        "Shift Started",
        `🟢 You are now clocked in.\nStarted <t:${Math.floor(now / 1000)}:R>.`
      )],
      ephemeral: true
    });
  }

  if (customId === "staff_break") {
    if (!shift) {
      return interaction.reply({
        embeds: [errorEmbed("No active shift", "Clock in before starting a break.")],
        ephemeral: true
      });
    }

    if (await statements.getActiveBreak(shift.id)) {
      return interaction.reply({
        embeds: [errorEmbed("Already on break", "You already have an active break.")],
        ephemeral: true
      });
    }

    const now = Date.now();
    await statements.startBreak(shift.id, now);

    return interaction.reply({
      embeds: [infoEmbed(
        "Break Started",
        `☕ Your break started <t:${Math.floor(now / 1000)}:R>.`
      )],
      ephemeral: true
    });
  }

  if (customId === "staff_endbreak") {
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
      embeds: [infoEmbed(
        "Break Ended",
        `🔵 Welcome back.\nBreak duration: **${formatDuration((now - activeBreak.started_at) / 1000)}**`
      )],
      ephemeral: true
    });
  }

  if (customId === "staff_clockout") {
    if (!shift) {
      return interaction.reply({
        embeds: [errorEmbed("No active shift", "You are not currently clocked in.")],
        ephemeral: true
      });
    }

    const activeBreak = await statements.getActiveBreak(shift.id);
    if (activeBreak) {
      return interaction.reply({
        embeds: [errorEmbed("Break still active", "End your break before clocking out.")],
        ephemeral: true
      });
    }

    const now = Date.now();
    const breaks = await statements.getBreaksForShift(shift.id);
    const paidSeconds = calculateShiftPaidSeconds(
      { ...shift, ended_at: now },
      breaks,
      now
    );

    await statements.endShift(now, shift.id);

    return interaction.reply({
      embeds: [infoEmbed(
        "Shift Ended",
        `🔴 Your shift has ended.\n\n**Paid time:** ${formatDuration(paidSeconds)}`
      )],
      ephemeral: true
    });
  }

  if (customId === "staff_hours") {
    const completed = await statements.getCompletedShifts(
      interaction.guildId,
      interaction.user.id,
      100
    );
    const active = await statements.getActiveShift(
      interaction.guildId,
      interaction.user.id
    );
    const adjustments = await statements.getAdjustments(
      interaction.guildId,
      interaction.user.id,
      1000
    );

    let shiftSeconds = 0;

    for (const item of completed) {
      shiftSeconds += calculateShiftPaidSeconds(
        item,
        await statements.getBreaksForShift(item.id)
      );
    }

    if (active) {
      shiftSeconds += calculateShiftPaidSeconds(
        active,
        await statements.getBreaksForShift(active.id)
      );
    }

    const adjustmentSeconds = adjustments.reduce(
      (sum, item) => sum + Number(item.amount_seconds),
      0
    );
    const total = Math.max(0, shiftSeconds + adjustmentSeconds);

    return interaction.reply({
      embeds: [infoEmbed(
        "My Hours",
        [
          `📊 **Total:** ${formatDuration(total)}`,
          `Shift time: ${formatDuration(shiftSeconds)}`,
          `Manual adjustments: ${adjustmentSeconds >= 0 ? "+" : "-"}${formatDuration(Math.abs(adjustmentSeconds))}`
        ].join("\n")
      )],
      ephemeral: true
    });
  }
}
