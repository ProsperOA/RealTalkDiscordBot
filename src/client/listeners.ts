import {
  Client,
  CommandInteraction,
  Message,
  MessageReaction,
  PartialMessage,
  PartialMessageReaction,
  PartialUser,
  User,
} from "discord.js";

import interactionHandlers from "./event-handlers/interactions";
import messageHandlers from "./event-handlers/messages";
import replies from "./replies";
import { InteractionCreateHandler } from "./event-handlers/interactions/interaction-create";
import { MessageDeleteHandler } from "./event-handlers/messages/message-delete";
import { MessageReactionHandler } from "./event-handlers/messages/message-reaction-add";
import { MessageReactionName } from "../client/message-reactions";

import {
  CustomLogData,
  CustomLogOptions,
  CustomMessageReaction,
  Timer,
  completeStructure,
  logger,
  timer,
} from "../utils";

const logCustom = (data: CustomLogData, responseTime: number): void => {
  const options: CustomLogOptions = {
    "Response Time": responseTime + "ms",
  };

  logger.custom(data, options);
};

const onInteractionCreate = (client: Client) =>
  async (interaction: CommandInteraction): Promise<void> => {
    if (!interaction.isCommand()) {
      return;
    }

    const { commandName }: CommandInteraction = interaction;
    const handlerFn: InteractionCreateHandler = interactionHandlers[commandName];

    if (!handlerFn) {
      logger.error(`No handler for command ${commandName}`);
      return interaction.reply(replies.internalError());
    }

    const t: Timer = timer();

    t.start();
    await handlerFn(client, interaction);
    t.stop();

    logCustom({ interaction }, t.time());
  };

const onMessageDelete = (client: Client) =>
  async (message: Message | PartialMessage): Promise<void> => {
    if (!message.content) {
      return;
    }

    const fullMessage: Message = await completeStructure<Message>(message);
    const shouldHardDelete: boolean = message.author.id === client.user.id;

    const handlerFn: MessageDeleteHandler = (
      shouldHardDelete ? messageHandlers.hardDelete : messageHandlers.softDelete
    ) as MessageDeleteHandler;

    const id: number = await handlerFn(fullMessage);

    if (id) {
      const deleteType: string = shouldHardDelete ? "hard" : "soft";
      logger.info(`Statement ${id} ${deleteType} deleted at ${new Date().toISOString()}`);
    }
  };

const onMessageReactionAdd = (client: Client) =>
  async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> => {
    const { emoji: { name: emojiName }}: MessageReaction | PartialMessageReaction = reaction;

    const shouldHaveHandlerFn: boolean = Object.values<string>(MessageReactionName)
      .includes(emojiName);

    if (!shouldHaveHandlerFn) {
      return;
    }

    const handlerFn: MessageReactionHandler = messageHandlers[emojiName] as MessageReactionHandler;

    if (!handlerFn) {
      return logger.error(`No handler for reaction ${emojiName}`);
    }

    const fullReaction: MessageReaction = await completeStructure<MessageReaction>(reaction);
    const fullUser: User = await completeStructure<User>(user);
    const t: Timer = timer();

    t.start();
    await handlerFn(client, fullUser, fullReaction);
    t.stop();

    const logData: CustomMessageReaction = {
      reaction: fullReaction,
      user: fullUser,
    };

    logCustom({ messageReaction: logData }, t.time());
  };

const register = (client: Client, debug?: boolean): void => {
  if (debug) {
    client.on("debug", logger.debug);
  }

  client.on("warn", logger.warn);
  client.on("error", logger.error);

  client.on("interactionCreate", onInteractionCreate(client));
  client.on("messageDelete", onMessageDelete(client));
  client.on("messageReactionAdd", onMessageReactionAdd(client));
};

export default { register };
