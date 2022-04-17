import { CommandInteraction } from "discord.js";

import replies from "./replies";
import { InteractionCreateHandler } from "./event-handlers/interactions/interaction-create";
import { cache, Cache } from "../utils";

const throttleCache: Cache = cache.new("throttleCache");

export const useThrottle = (callback: InteractionCreateHandler, duration: number): InteractionCreateHandler =>
  async (interaction: CommandInteraction, ...args: any[]): Promise<void> => {
    if (duration <= 0) {
      return callback(interaction, ...args);
    }

    const userId: string = interaction.user.id;
    const timeout: number = throttleCache.ttl(userId);

    if (timeout) {
      return interaction.reply(replies.throttleCoolDown(timeout));
    }

    throttleCache.setF(userId, new Date().toISOString(), duration);

    await callback(interaction, ...args);
  };
