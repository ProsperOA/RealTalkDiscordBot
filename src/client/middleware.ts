import { CommandInteraction } from "discord.js";
import { merge } from "lodash";

import replies from "./replies";
import { cache, Cache, formatUserId, getUsername, logger } from "../utils";
import { ThrottleConfig } from "./event-handlers/interactions/interaction-create";
import { InteractionCreateHandler, InteractionCreateInput } from "./event-handlers/interactions";

export interface Middleware {
  throttle?: {
    remove: (interaction: CommandInteraction) => boolean;
  };
  rateLimit?: {
    decrement: (interaction: CommandInteraction) => boolean;
  };
}

export interface RateLimitOptions {
  limit: number;
  timeFrame: number;
}

export type InteractionCreateMiddleware =
  (...args: any[]) => Promise<InteractionCreateInput>;

type ThrottleConfigure =
  (interaction: CommandInteraction, name: keyof typeof ThrottleConfig) => Promise<number>;

type RateLimitConfigure =
  (interaction: CommandInteraction, name: string) => Promise<RateLimitOptions>;

const throttleCache: Cache = cache.new("throttleCache");
const rateLimitCache: Cache = cache.new("rateLimitUsersCache");

export const buildMiddlewareCacheKey = (interaction: CommandInteraction): string =>
  `${interaction.options.getSubcommand()}:${interaction.user.id}`;

const removeThrottle = (interaction: CommandInteraction): boolean =>
  throttleCache.delete(buildMiddlewareCacheKey(interaction));

const decrementRateLimit = (interaction: CommandInteraction): boolean => {
  const key: string = buildMiddlewareCacheKey(interaction);
  const totalUsage: number = rateLimitCache.get(key);
  const ttl: number = rateLimitCache.ttl(key);

  return totalUsage === 1
    ? rateLimitCache.delete(key)
    : rateLimitCache.setF(key, totalUsage - 1, ttl);
};

const mergeInput = (input: InteractionCreateInput, middleware: Middleware): InteractionCreateInput => ({
  ...input,
  middleware: merge(input.middleware, middleware),
});

export const applyMiddleware = (middlewares: InteractionCreateMiddleware[], handler: InteractionCreateHandler) =>
  async (input: InteractionCreateInput, ...args: any[]): Promise<void> => {
    let finalInput: InteractionCreateInput = null;
    let runHandler: boolean = true;

    for (const middleware of middlewares) {
      const newInput = await middleware(input, handler);

      if (!newInput) {
        runHandler = false;
        break;
      }

      finalInput = merge(finalInput || {}, newInput);
    }

    if (runHandler) {
      await handler(finalInput, ...args);
    }
  };

export const useThrottle = (configure: ThrottleConfigure) =>
  async (input: InteractionCreateInput, handler: InteractionCreateHandler): Promise<InteractionCreateInput> => {
    const { interaction }: InteractionCreateInput = input;

    const duration: number =
      await configure(interaction, handler.name as keyof typeof ThrottleConfig);

    const userId: string = interaction.user.id;
    const key: string = buildMiddlewareCacheKey(interaction);

    if (duration < 0) {
      logger.warn(`Invalid duration of ${duration} on ${key}`);
    }

    const timeout: number = throttleCache.ttl(key);

    if (timeout) {
      const subcommand: string = interaction.options.getSubcommand();
      await interaction.reply(replies.throttleCoolDown(interaction, timeout));

      logger.info(`Throttle limit reached on /${subcommand} for ${formatUserId(userId)} (${getUsername(userId)})`);
      return null;
    }

    throttleCache.setF(key, new Date().toISOString(), Math.max(0, duration));

    return mergeInput(input, { throttle: { remove: removeThrottle }});
  };

export const useRateLimit = (configure: RateLimitConfigure) =>
  async (input: InteractionCreateInput, handler: InteractionCreateHandler): Promise<InteractionCreateInput> => {
    const { interaction }: InteractionCreateInput = input;

    const key: string = buildMiddlewareCacheKey(interaction);
    const options: RateLimitOptions = await configure(interaction, handler.name);
    const totalUsage: number = (rateLimitCache.get(key) || 0) + 1;
    const timeout: number = rateLimitCache.ttl(key);

    if (timeout && totalUsage > options.limit) {
      const subcommand: string = interaction.options.getSubcommand();
      await interaction.reply(replies.rateLimitHit(interaction, timeout));
      const userId: string = interaction.user.id;

      logger.info(`Rate limit reached on /${subcommand} for ${formatUserId(userId)} (${getUsername(userId)})`);
      return null;
    }

    rateLimitCache.setF(key, totalUsage, options.timeFrame);

    return mergeInput(input, { rateLimit: { decrement: decrementRateLimit }});
  };
