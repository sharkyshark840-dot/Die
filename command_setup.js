import {
  ActionRowBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  SlashCommandBuilder
} from "discord.js";
import { statements } from "./database.js";
import { isDiscordAdministrator } from "./util_permissions.js";
import { successEmbed, errorEmbed } from "./util_embeds.js";

export const data = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("Configure the Staff Time Bot.")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  if (!isDiscordAdministrator(interaction)) {
    return interaction.reply({
      embeds: [errorEmbed("Permission denied", "Only Discord Administrators can configure the bot.")],
      ephemeral: true
    });
  }

  const menu = new RoleSelectMenuBuilder()
    .setCustomId("setup_admin_role")
    .setPlaceholder("Select the Staff Admin role")
    .setMinValues(1)
    .setMaxValues(1);

  return interaction.reply({
    embeds: [successEmbed("Staff Time Bot Setup", "Select the role that should be allowed to manage staff time records.")],
    components: [new ActionRowBuilder().addComponents(menu)],
    ephemeral: true
  });
}

export async function handleSetupRoleSelect(interaction) {
  if (!isDiscordAdministrator(interaction)) {
    return interaction.reply({
      embeds: [errorEmbed("Permission denied", "Only Discord Administrators can change this setting.")],
      ephemeral: true
    });
  }

  const roleId = interaction.values[0];

  await statements.upsertSettings({
    guildId: interaction.guildId,
    adminRoleId: roleId,
    updatedAt: Date.now()
  });

  const role = interaction.guild.roles.cache.get(roleId);

  return interaction.update({
    embeds: [successEmbed(
      "Staff Admin Role Updated",
      `${role ? role.toString() : "The selected role"} can now manage staff time records.`
    )],
    components: []
  });
}
