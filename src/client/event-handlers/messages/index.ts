import messageReactionAddHandlers from "./message-reaction-add";
import messageDeleteHandlers from "./message-delete";

export default {
  ...messageDeleteHandlers,
  ...messageReactionAddHandlers,
} as any;
