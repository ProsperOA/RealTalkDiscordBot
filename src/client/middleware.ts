import { Client, CommandInteraction } from "discord.js";

import replies from "./replies";
import { InteractionCreateHandler } from "./event-handlers/interactions/interaction-create";
import { cache, Cache, logger } from "../utils";

const throttleCache: Cache = cache.new("throttleCache");

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
