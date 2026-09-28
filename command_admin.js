import { SlashCommandBuilder } from "discord.js";
import { statements } from "./database.js";
import { canManageStaff } from "./util_permissions.js";
import { errorEmbed, successEmbed, infoEmbed } from "./util_embeds.js";
import { parseDuration, formatDuration } from "./util_time.js";

export const data = new SlashCommandBuilder()
  .setName("admin")
  .setDescription("Manage staff time records.")
  .addSubcommand(sub => sub
    .setName("addtime")
    .setDescription("Add recorded time to a staff member.")
    .addUserOption(option => option.setName("staff").setDescription("Staff member").setRequired(true))
    .addStringOption(option => option.setName("duration").setDescription("Example: 30m, 2h, 90s").setRequired(true))
    .addStringOption(option => option.setName("reason").setDescription("Required audit reason").setRequired(true).setMaxLength(500)))
  .addSubcommand(sub => sub
    .setName("removetime")
    .setDescription("Remove recorded time from a staff member.")
    .addUserOption(option => option.setName("staff").setDescription("Staff member").setRequired(true))
    .addStringOption(option => option.setName("duration").setDescription("Example: 15m, 1h, 90s").setRequired(true))
    .addStringOption(option => option.setName("reason").setDescription("Required audit reason").setRequired(true).setMaxLength(500)))
  .addSubcommand(sub => sub
    .setName("history")
    .setDescription("View manual time-adjustment history.")
    .addUserOption(option => option.setName("staff").setDescription("Staff member").setRequired(true)));

export async function execute(interaction) {
  if (!(await canManageStaff(interaction))) {
    return interaction.reply({
      embeds: [errorEmbed("Permission denied", "You do not have the configured Staff Admin role.")],
      ephemeral: true
    });
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "history") {
    const target = interaction.options.getUser("staff", true);
    const rows = await statements.getAdjustments(interaction.guildId, target.id, 15);

    if (!rows.length) {
      return interaction.reply({
        embeds: [infoEmbed("Adjustment History", `${target} has no manual time adjustments.`)],
        ephemeral: true
      });
    }

    const lines = rows.map(row => {
      const sign = row.amount_seconds >= 0 ? "+" : "-";
      return `${sign}${formatDuration(Math.abs(row.amount_seconds))} • <t:${Math.floor(row.created_at / 1000)}:d> • <@${row.admin_id}> • ${row.reason}`;
    });

    return interaction.reply({
      embeds: [infoEmbed(`Adjustment History — ${target.username}`, lines.join("\n").slice(0, 3900))],
      ephemeral: true
    });
  }

  const target = interaction.options.getUser("staff", true);
  const durationInput = interaction.options.getString("duration", true);
  const reason = interaction.options.getString("reason", true);
  const seconds = parseDuration(durationInput);

  if (!seconds || seconds <= 0) {
    return interaction.reply({
      embeds: [errorEmbed("Invalid duration", "Use a value such as `30m`, `2h`, or `90s`.")],
      ephemeral: true
    });
  }

  const signedSeconds = subcommand === "addtime" ? seconds : -seconds;

  await statements.addAdjustment(
    interaction.guildId,
    target.id,
    interaction.user.id,
    signedSeconds,
    reason,
    Date.now()
  );

  const action = subcommand === "addtime" ? "Time Added" : "Time Removed";
  const verb = subcommand === "addtime" ? "Added" : "Removed";

  return interaction.reply({
    embeds: [successEmbed(
      action,
      `${verb} **${formatDuration(seconds)}** ${subcommand === "addtime" ? "to" : "from"} ${target}.\n\n**Reason:** ${reason}`
    )],
    ephemeral: true
  });
}
