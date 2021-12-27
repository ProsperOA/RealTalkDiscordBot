import { Client, CommandInteraction } from 'discord.js';

import { CommandFunction } from '.';
import { throttleBuilder } from './reply-builder';

const userThrottleCache: {[userId: string]: NodeJS.Timeout} = {};

/**
 * Returns remaining time for setTimeout.
 *
 * @param   {Timeout} timeout - Reference to timeout object.
 * @returns {number}
 */
const getRemainingTimeout = ({ _idleStart, _idleTimeout }: any): number =>
  Math.ceil((_idleStart + _idleTimeout) / 1000 - process.uptime());

/**
 * Throttles command requests per user.
 *
 * @param   {CommandFunction} callback - Command function callback.
 * @param   {number}          duration - Throttle time in ms.
 * @returns {CommandFunction}
 */
export const useThrottle = (callback: CommandFunction, duration: number) =>
  (client: Client, interaction: CommandInteraction) => {
    const userId: string = interaction.user.id;
    const timeoutRef: NodeJS.Timeout = userThrottleCache[userId];

    if (timeoutRef) {
      const remainingTimeout: number = getRemainingTimeout(timeoutRef);
      interaction.reply(throttleBuilder.coolDown(remainingTimeout));
      return;
    }

    callback(client, interaction);

    userThrottleCache[userId] =
      setTimeout(() => delete userThrottleCache[userId], duration);
  };
