import { CommandInteraction, CommandInteractionOption } from 'discord.js';

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

/**
 * Adds indentation to a multiline string.
 *
 * @param   {string} str    - string to format
 * @param   {number} indent - indent size
 * @returns {string}
 */
export const multilineIndent = (str: string, indent: number = 1): string => {
  const indentSize: number = Math.abs(indent);
  let space: string = '';

  for (let i = 1; i <= indentSize; i++) {
    space += ' ';
  }

  return str.split('\n')
    .map(line => `${space}${line}`)
    .join('\n');
};
