import { PermissionFlagsBits } from "discord.js";
import { statements } from "./database.js";

export function isDiscordAdministrator(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
}

export async function getSettings(guildId) {
  return await statements.getSettings(guildId);
}

export async function hasStaffAdminRole(interaction) {
  const settings = await getSettings(interaction.guildId);
  if (!settings?.admin_role_id) return false;
  return interaction.member?.roles?.cache?.has(settings.admin_role_id) ?? false;
}

export async function canManageStaff(interaction) {
  return isDiscordAdministrator(interaction) || await hasStaffAdminRole(interaction);
}
