import { Client, CommandInteraction } from 'discord.js';

import replyBuilder from './reply-builder';
import { CommandFunction } from './command-interface';
import { getRemainingTimeout, Timeout } from '../utils';

const userThrottleCache: {[userId: string]: Timeout} = {};

/**
 * Throttles command requests per user.
 *
 * @param   {CommandFunction} callback - Command function callback.
 * @param   {number}          duration - Throttle time in ms.
 * @returns {CommandFunction}
 */
export const useThrottle = (callback: CommandFunction, duration: number) =>
  async (client: Client, interaction: CommandInteraction) => {
    const userId: string = interaction.user.id;
    const timeout: Timeout = userThrottleCache[userId];

    if (timeout) {
      const remainingTimeout: number = getRemainingTimeout(timeout);
      return interaction.reply(replyBuilder.throttleCoolDown(remainingTimeout));
    }

    userThrottleCache[userId] =
      setTimeout(() => delete userThrottleCache[userId], duration) as Timeout;

    await callback(client, interaction);
  };
