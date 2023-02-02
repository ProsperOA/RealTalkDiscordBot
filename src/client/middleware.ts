import { Client, CommandInteraction } from "discord.js";

import replies from "./replies";
import { InteractionCreateHandler } from "./event-handlers/interactions/interaction-create";
import { cache, Cache, logger } from "../utils";

export interface RateLimitOptions {
  limit: number;
  timeFrame: number;
}

const throttleCache: Cache = cache.new("throttleCache");
const rateLimitCache: Cache = cache.new("rateLimitUsersCache");

export const useThrottle = (cb: InteractionCreateHandler, duration: number): InteractionCreateHandler =>
  async (client: Client, interaction: CommandInteraction, ...args: any[]): Promise<void> => {
    const userId: string = interaction.user.id;
    const subcommand: string = interaction.options.getSubcommand();
    const key: string = `${subcommand}:${userId}`;

    if (duration < 0) {
      logger.warn(`Invalid duration of ${duration} on ${key}`);
    }

    const timeout: number = throttleCache.ttl(key);

    if (timeout) {
      return interaction.reply(replies.throttleCoolDown(timeout, subcommand));
    }

    throttleCache.setF(key, new Date().toISOString(), Math.max(0, duration));

    await cb(client, interaction, ...args);
  };

export const useRateLimit = (cb: InteractionCreateHandler, options: RateLimitOptions): InteractionCreateHandler =>
  async (client: Client, interaction: CommandInteraction, ...args: any[]): Promise<void> => {
    const userId: string = interaction.user.id;
    const timeout: number = rateLimitCache.ttl(userId);
    const totalUsage: number = (rateLimitCache.get(userId) || 0) + 1;

    if (!rateLimitCache.has(userId)) {
      rateLimitCache.set(userId, totalUsage, options.timeFrame);
    } else if (timeout && totalUsage > options.limit) {
      return interaction.reply(replies.rateLimitHit(timeout));
    }

    rateLimitCache.setF(userId, totalUsage + 1, timeout);

    await cb(client, interaction, ...args);
  };