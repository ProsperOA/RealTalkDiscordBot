import { CommandInteraction, CommandInteractionOption } from "discord.js";

/**
 * Returns remaining time for setTimeout.
 *
 * @param   {any}    timeout - Reference to timeout object.
 * @returns {number}
 */
export const getRemainingTimeout = ({ _idleStart, _idleTimeout }: any): number =>
  Math.ceil((_idleStart + _idleTimeout) / 1000 - process.uptime());

/**
 * Returns an interaction's subcommand.
 *
 * @param   {CommandInteraction} interaction - Reference to interaction object.
 * @returns {CommandInteractionOption}
 */
export const getSubCommand = (interaction: CommandInteraction): CommandInteractionOption =>
  interaction.options.data[0];