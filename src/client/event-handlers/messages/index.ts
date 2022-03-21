import messageReactionAddHandlers, { MessageReactionHandler } from "./message-reaction-add";
import messageDeleteHandlers, { MessageDeleteHandler } from "./message-delete";

interface MessageHandlers {
  [name: string]: MessageReactionHandler | MessageDeleteHandler;
}

export default {
  ...messageDeleteHandlers,
  ...messageReactionAddHandlers,
} as MessageHandlers;
