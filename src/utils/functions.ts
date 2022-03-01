import { User } from 'discord.js';
import { memberNicknameMention } from '@discordjs/builders';

import { isDev } from './index';
import { getUser } from './guild';

export interface Timer {
  start: () => Date;
  stop: () => Date;
  time: () => number;
}

export interface Timeout extends NodeJS.Timeout {
  _idleStart: number;
  _idleTimeout: number;
}

interface PartialStructure<T = any> {
  partial: boolean;
  fetch: (force?: boolean) => Promise<T>;
  [key: string]: any;
}

/**
 * Returns remaining time for setTimeout.
 *
 * @param   {Timeout} timeout - Reference to timeout object.
 * @returns {number}
 */
export const getRemainingTimeout = ({ _idleStart, _idleTimeout }: Timeout): number => {
  const timeout: number = Math.ceil((_idleStart + _idleTimeout) / 1000 - process.uptime());
  return timeout >= 0 ? timeout : 0;
};

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
  (typeof pluralize === 'boolean' && !pluralize) || pluralize === 1
    ? str
    : `${str}s`;

/**
 * Returns a formatted userId in dev, but nickname mention in prod. This prevents
 * spamming mentions in dev.
 *
 * @param   {string} userId - user id to format
 * @returns {string}
 */
export const nicknameMention = (userId: string): string => {
  const user: User = getUser(userId);

  if (!user) {
    return `UserID::${userId}`;
  }

  return isDev ? user.tag : memberNicknameMention(userId);
};

export const fetchFull = async <T>(partial: PartialStructure<T>, force?: boolean): Promise<T> => {
  let fullStructure: T = null;

  try {
    fullStructure = await partial.fetch(force);
  } catch (error) {
    logger.error(error);
  }

  return fullStructure;
};

/**
 * Provides an interface that calculates the time in ms between a start and end
 * time.
 *
 * @returns {Timer}
 */
export const timer = (): Timer => {
  let startDate: Date = null;
  let totalTime: number = 0;

  return {
    start: (): Date => {
      startDate = new Date();
      return startDate;
    },
    stop: (): Date => {
      const endDate: Date = new Date();

      if (startDate) {
        totalTime = endDate.getTime() - startDate.getTime();
      }

      return endDate;
    },
    time: (): number => totalTime,
  };
};
