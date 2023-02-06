import { Client, CommandInteraction } from "discord.js";

import replies from "./replies";
import { cache, Cache, getUsername, logger } from "../utils";

import {
  InteractionCreateHandler,
  InteractionCreateInput,
  ThrottleConfig,
} from "./event-handlers/interactions/interaction-create";
import { xor } from "lodash";

export interface Middleware {
  throttle?: {
    cache: Cache;
  };
  rateLimit?: {
    cache: Cache;
  };
}

export interface RateLimitOptions {
  limit: number;
  timeFrame: number;
}

export type InteractionCreateMiddleware = (...args: any[]) => Promise<InteractionCreateInput>;

const throttleCache: Cache = cache.new("throttleCache");
const rateLimitCache: Cache = cache.new("rateLimitUsersCache");

export const buildMiddlewareCacheKey = (interaction: CommandInteraction, userId: string): string =>
  `${interaction.options.getSubcommand()}:${userId}`;

const modifyInput = (input: InteractionCreateInput, middleware: Middleware): InteractionCreateInput =>
  xor(Object.keys(input.middleware || {}), Object.keys(middleware)).length
    ? {
        ...input,
        middleware: {
          ...middleware,
        },
      }
    : input;

export const applyMiddleware = (middlewares: InteractionCreateMiddleware[], handler: InteractionCreateHandler) =>
  async (input: InteractionCreateInput): Promise<void> => {
    let finalInput: InteractionCreateInput = null;

    for (const middleware of middlewares) {
      finalInput = await middleware(input, handler);

      if (!finalInput) {
        break;
      }
    }

    if (finalInput) {
      await handler(finalInput);
    }
  };

export const useThrottle = (configure: (name: keyof typeof ThrottleConfig) => number) =>
  async (input: InteractionCreateInput, handler: InteractionCreateHandler): Promise<InteractionCreateInput> => {
    const { interaction }: InteractionCreateInput = input;
    const duration: number = configure(handler.name as keyof typeof ThrottleConfig);
    const userId: string = interaction.user.id;
    const key: string = buildMiddlewareCacheKey(interaction, userId);

    if (duration < 0) {
      logger.warn(`Invalid duration of ${duration} on ${key}`);
    }

    const timeout: number = throttleCache.ttl(key);

    if (timeout) {
      const subcommand: string = interaction.options.getSubcommand();
      await interaction.reply(replies.throttleCoolDown(timeout, subcommand));

      logger.info(`Throttle limit reached on /${subcommand} for UserID::${userId} (${getUsername(userId)})`);
      return null;
    }

    throttleCache.setF(key, new Date().toISOString(), Math.max(0, duration));

    return modifyInput(input, { throttle: { cache: throttleCache }});
  };

export const useRateLimit = (configure: (name: string) => RateLimitOptions) =>
  async (input: InteractionCreateInput, handler: InteractionCreateHandler): Promise<InteractionCreateInput> => {
    const { interaction }: InteractionCreateInput = input;
    const options: RateLimitOptions = configure(handler.name);
    const userId: string = interaction.user.id;
    const timeout: number = rateLimitCache.ttl(userId);
    const totalUsage: number = (rateLimitCache.get(userId) || 0) + 1;

    if (!rateLimitCache.has(userId)) {
      rateLimitCache.set(userId, totalUsage, options.timeFrame);
    } else if (timeout && totalUsage > options.limit) {
      await interaction.reply(replies.rateLimitHit(timeout));
      const subcommand: string = interaction.options.getSubcommand();

      logger.info(`Rate limit reached on /${subcommand} for UserID::${userId} (${getUsername(userId)})`);
      return null;
    }

    const key: string = buildMiddlewareCacheKey(interaction, userId);
    rateLimitCache.setF(key, totalUsage, timeout);

    return modifyInput(input, { rateLimit: { cache: rateLimitCache }});
  };
