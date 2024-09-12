import { Client, CommandInteraction } from "discord.js";

import interactionCreateHandler from "./interaction-create";
import { Middleware } from "../../middleware";

interface InteractionHandlers {
  [name: string]: InteractionCreateHandler;
}
export interface InteractionCreateInput {
  client: Client;
  interaction: CommandInteraction;
  middleware?: Middleware;
}

export type InteractionCreateHandler =
  (input: InteractionCreateInput, ...args: any[]) => Promise<void>;


export default {
  ...interactionCreateHandler,
} as InteractionHandlers;
