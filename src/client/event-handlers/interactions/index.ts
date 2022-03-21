import interactionCreateHandler, { InteractionCreateHandler } from "./interaction-create";

interface InteractionHandlers {
  [name: string]: InteractionCreateHandler;
}

export default {
  ...interactionCreateHandler,
} as InteractionHandlers;
