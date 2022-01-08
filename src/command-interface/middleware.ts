import { Client, CommandInteraction } from 'discord.js';

import replyBuilder from './reply-builder';
import { CommandFunction } from './index';
import { getRemainingTimeout } from '../utils';

const userThrottleCache: {[userId: string]: NodeJS.Timeout} = {};

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
    const timeout: NodeJS.Timeout = userThrottleCache[userId];

    if (timeout) {
      const remainingTimeout: number = getRemainingTimeout(timeout);
      interaction.reply(replyBuilder.throttleCoolDown(remainingTimeout));
      return;
    }

    userThrottleCache[userId] =
      setTimeout(() => delete userThrottleCache[userId], duration);

    await callback(client, interaction);
  };
