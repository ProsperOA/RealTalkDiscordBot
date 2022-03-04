import { Client, CommandInteraction } from 'discord.js';

import replyBuilder from './reply-builder';
import { CommandFunction } from './command-interface';
import { cache, Cache } from '../utils';

const throttleCache: Cache = cache.new('throttleCache');

/**
 * Throttles command requests per user.
 *
 * @param   {CommandFunction} callback - Command function callback.
 * @param   {number}          duration - Throttle time in ms.
 * @returns {CommandFunction}
 */
export const useThrottle = (callback: CommandFunction, duration: number): CommandFunction =>
  async (client: Client, interaction: CommandInteraction, ...args: any[]): Promise<void> => {
    if (duration <= 0) {
      return callback(client, interaction, ...args);
    }

    const userId: string = interaction.user.id;
    const timeout: number = throttleCache.ttl(userId);

    if (timeout) {
      return interaction.reply(replyBuilder.throttleCoolDown(timeout));
    }

    throttleCache.setF(userId, new Date().toUTCString(), duration);

    await callback(client, interaction, ...args);
  };
