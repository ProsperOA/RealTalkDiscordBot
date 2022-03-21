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
import replyBuilder from "../client/reply-builder";
import { InteractionCreateHandler } from "./event-handlers/interactions/interaction-create";
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
  getUsername,
  getUser,
} from "../utils";

const logCustom = (data: CustomLogData, responseTime: number): void => {
  const options: CustomLogOptions = {
    "Response Time": `${responseTime}ms`,
  };

  logger.custom(data, options);
};

const onInteractionCreate = async (interaction: CommandInteraction): Promise<void> => {
  if (!interaction.isCommand()) {
    return;
  }

  const { commandName } = interaction;
  const handlerFn: InteractionCreateHandler = interactionHandlers[commandName];

  if (!handlerFn) {
    logger.error(`No handler for command ${commandName}`);
    return interaction.reply(replyBuilder.internalError());
  }

  const t: Timer = timer();

  t.start();
  await handlerFn(interaction);
  t.stop();

  logCustom({ interaction }, t.time());
};

const onMessageDelete = async (message: Message | PartialMessage): Promise<void> => {
  const fullMessage: Message = await completeStructure<Message>(message);
  const deletedAt: Date = await messageHandlers.setDeleted(fullMessage);

  const { author, id } = fullMessage;

  if (deletedAt) {
    logger.info(
      `Statement ${id} from ${getUser(author.id).tag} deleted at ${deletedAt.toISOString()}`
    );
  }
};

const onMessageReactionAdd = (client: Client) =>
  async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> => {
    const { emoji: { name: emojiName } } = reaction;

    const shouldHaveHandlerFn: boolean = Object.values<string>(MessageReactionName)
      .includes(emojiName);

    if (!shouldHaveHandlerFn) {
      return;
    }

    const handlerFn: MessageReactionHandler = messageHandlers[emojiName];

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

  client.on("interactionCreate", onInteractionCreate);
  client.on("messageDelete", onMessageDelete);
  client.on("messageReactionAdd", onMessageReactionAdd(client));
};

export default { register };
