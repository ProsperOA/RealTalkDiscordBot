import messageReactionAddHandlers, { MessageReactionHandler } from "./message-reaction-change";
import messageDeleteHandlers, { MessageDeleteHandler } from "./message-delete";

interface MessageHandlers {
  [name: string]: MessageReactionHandler | MessageDeleteHandler;
}

export default {
  ...messageDeleteHandlers,
  ...messageReactionAddHandlers,
} as MessageHandlers;
