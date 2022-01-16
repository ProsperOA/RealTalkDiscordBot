import { memberNicknameMention } from '@discordjs/builders';
import { User } from 'discord.js';
import { cond, constant, stubTrue } from 'lodash';

import { isDev } from './index';
import { getUser } from './users';

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

  const indentSize: number = indent < 1 ? 1 : indent;
  const space: string = Array.from({ length: indentSize }, () => ' ').join('');

  return str.split('\n')
    .map(line => space + line)
    .join('\n');
};

/**
 * Returns plural form of a string if a pluralize is not 1 or true.
 *
 * @param   {string} str - string to format
 * @param   {boolean | number} pluralize - number or boolean to check
 * @returns {string}
 */
export const pluralizeIf = (str: string, pluralize: boolean | number): string =>
  pluralize === 1 || !pluralize ? str : str + 's';

/**
 * Returns a formatted userId in dev, but nickname mention in prod. This prevents
 * spamming mentions in dev.
 *
 * @param   {string} userId - user id to format
 * @returns {string}
 */
export const nicknameMention = (userId: string): string => {
  const user: User = getUser(userId);

  return cond([
    [ constant(!user), constant('UserID::' + userId) ],
    [ constant(isDev), constant(user.tag) ],
    [ stubTrue, constant(memberNicknameMention(userId)) ]
  ])(isDev);
};
  // isDev ? getUser(userId).username : memberNicknameMention(userId);
