import {
  Client,
  CommandInteraction,
  Interaction,
  Message,
  MessageComponentInteraction,
  MessageReaction,
  PartialMessage,
  PartialMessageReaction,
  PartialUser,
  User,
} from "discord.js";

import interactionHandlers, { InteractionCreateHandler } from "./event-handlers/interactions";
import messageComponentHandlers from "./event-handlers/interactions/message-components";
import messageHandlers from "./event-handlers/messages";
import replies from "./replies";
import { MessageDeleteHandler } from "./event-handlers/messages/message-delete";
import { MessageReactionChangeType, MessageReactionHandler } from "./event-handlers/messages/message-reaction-change";
import { MessageReactionName } from "../client/message-reactions";
import { MessageComponentId } from "./slash-commands";

import {
  CustomLogData,
  CustomLogOptions,
  CustomMessageReaction,
  Timer,
  completeStructure,
  logger,
  timer,
  cache,
  Cache,
  Time,
  delayDeleteMessage,
  Config,
  isOwner,
} from "../utils";

const INTERACTION_DONATION_LINK_THRESHOLD: number =
  Number(process.env.INTERACTION_DONATION_LINK_THRESHOLD) || 3;

const userInteractionsCache: Cache = cache.new("userInteractionsCache");

const sendDonationLink = async (user: User): Promise<void> => {
  const totalUserInteractions: number = (userInteractionsCache.get(user.id) || 0) + 1;

  if (userInteractionsCache.set(user.id, totalUserInteractions, Time.Hour * 8)) {
    return;
  }

  const message: Message = totalUserInteractions === INTERACTION_DONATION_LINK_THRESHOLD
    ? await user.send(replies.donationLink())
    : null;

  if (message) {
    delayDeleteMessage(Time.Minute * 5, message);
  }

  userInteractionsCache.setF(
    user.id,
    totalUserInteractions,
    userInteractionsCache.ttl(user.id)
  );
};

const logCustom = (data: CustomLogData, responseTime: number): void => {
  const options: CustomLogOptions = {
    "Response Time": responseTime + "ms",
  };

  logger.custom(data, options);
};

const handleCommand = async (client: Client, interaction: CommandInteraction): Promise<void> => {
  const { commandName }: CommandInteraction = interaction;
  const handlerFn: InteractionCreateHandler = interactionHandlers[commandName];

  if (!handlerFn) {
    logger.error(`No handler for command ${commandName}`);
    return interaction.reply(replies.internalError(interaction));
  }

  if (!(Config.IsDev || await isOwner(interaction.user.id))) {
    await sendDonationLink(interaction.user);
  }

  const t: Timer = timer();

  t.start();
  await handlerFn({ client, interaction });
  t.stop();

  logCustom({ interaction }, t.time());
};

const handleMessageComponent = async (client: Client, interaction: MessageComponentInteraction): Promise<void> => {
  const componentId: MessageComponentId = interaction.customId as MessageComponentId;
  const handlerFn = messageComponentHandlers[componentId];

  if (!handlerFn) {
    logger.error(`No handler for message component ${componentId}`);
    return interaction.reply(replies.internalError());
  }

  await handlerFn(client, interaction);
};

const onInteractionCreate = (client: Client) =>
  async (interaction: Interaction): Promise<void> => {
    switch (interaction.type) {
      case "APPLICATION_COMMAND":
        await handleCommand(client, interaction as CommandInteraction);
        break;
      case "MESSAGE_COMPONENT":
        await handleMessageComponent(client, interaction as MessageComponentInteraction);
        break;
      default:
        logger.error(`Invalid interaction type: ${interaction.type}`);
        return;
    }
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

const onMessageReactionChange = (client: Client, type: MessageReactionChangeType) =>
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
    await handlerFn(client, fullUser, fullReaction, type);
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
  client.on("messageReactionAdd", onMessageReactionChange(client, "add"));
  client.on("messageReactionRemove", onMessageReactionChange(client, "remove"));
};

export default { register };
