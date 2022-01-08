import { Client, CommandInteraction } from 'discord.js';

import { CommandFunction } from './index';
import { getRemainingTimeout } from '../utils';
import { throttleReply } from './reply-builder';

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
      interaction.reply(throttleReply.coolDown(remainingTimeout));
      return;
    }

    userThrottleCache[userId] =
      setTimeout(() => delete userThrottleCache[userId], duration);

    await callback(client, interaction);
  };
