import { memberNicknameMention } from '@discordjs/builders';

import { isDev } from './index';

export interface Timeout extends NodeJS.Timeout {
  _idleStart: number;
  _idleTimeout: number;
}

/**
 * Returns remaining time for setTimeout.
 *
 * @param   {Timeout} timeout - Reference to timeout object.
 * @returns {number}
 */
export const getRemainingTimeout = ({ _idleStart, _idleTimeout }: Timeout): number =>
  Math.ceil((_idleStart + _idleTimeout) / 1000 - process.uptime());

/**
 * Adds indentation to a multiline string.
 *
 * @param   {string} str    - string to format
 * @param   {number} indent - indent size
 * @returns {string}
 */
export const multilineIndent = (str: string, indent: number = 1): string => {
  if (str.indexOf('\n') === -1) {
    return str;
  }

  const indentSize: number = Math.abs(indent);
  const space: string = Array.from({ length: indentSize }, () => ' ').join('');

  return str.split('\n')
    .map(line => space + line)
    .join('\n');
};

/**
 * Returns plural form of a string if a condition is met.
 *
 * @param   {string} str - string to format
 * @param   {boolean | number} cond - number or boolean to check
 * @returns {string}
 */
export const pluralizeIf = (str: string, cond: boolean | number): string =>
  cond === 1 || !cond ? str : `${str}s`;

/**
 * Returns a formatted userId in dev, but nickname mention in prod. This prevents
 * spamming mentions in dev.
 *
 * @param   {string} userId - user id to format
 * @returns {string}
 */
export const nicknameMention = (userId: string): string =>
  isDev ? `UserID::${userId}` : memberNicknameMention(userId);
