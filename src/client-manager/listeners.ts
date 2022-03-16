import {
  Awaitable,
  Client,
  ClientEvents,
  CommandInteraction,
  Message,
  MessageReaction,
  PartialMessage,
  PartialMessageReaction,
  PartialUser,
  User,
} from 'discord.js';

import messageInterface from './message-interface';
import replyBuilder from './reply-builder';
import { CommandFunction, commandInterfaceMap } from './command-interface';
import { ReactionFunction, reactionInterfaceMap } from './reaction-interface';
import { ReactionName } from './reactions';

import {
  CustomLogOptions,
  CustomLogData,
  CustomMessageReaction,
  logger,
  Timer,
  timer,
  fetchFull,
} from '../utils';

type CommandInteractionHandler = (...args: ClientEvents['interactionCreate']) => Awaitable<void>;
type MessageDeleteHandler = (...args: ClientEvents['messageDelete']) => Awaitable<void>;
type MessageReactionHandler = (...args: ClientEvents['messageReactionAdd']) => Awaitable<void>;

const logCustom = (data: CustomLogData, responseTime: number): void => {
  const options: CustomLogOptions = {
    'Response Time': `${responseTime}ms`,
  };

  logger.custom(data, options);
};

const onInteractionCreate = (client: Client): CommandInteractionHandler =>
  async (interaction: CommandInteraction): Promise<void> => {
    if (!interaction.isCommand()) {
      return;
    }

    const { commandName } = interaction;
    const handlerFn: CommandFunction = commandInterfaceMap[commandName];

    if (!handlerFn) {
      logger.error(`No handler for command ${commandName}`);
      return interaction.reply(replyBuilder.internalError());
    }

    const t: Timer = timer();

    t.start();
    await handlerFn(client, interaction);
    t.stop();

    logCustom({ interaction }, t.time());
  };

const onMessageDelete = (client: Client): MessageDeleteHandler =>
  async (message: Message | PartialMessage): Promise<void> => {
    if (message.type !== 'APPLICATION_COMMAND') {
      return;
    }

    const fullMessage: Message = message.partial
      ? await fetchFull<Message>(message)
      : message as Message;

    await messageInterface.onMessageDelete(client, fullMessage);
  };

const onMessageReactionAdd = (client: Client): MessageReactionHandler =>
  async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> => {
    const { emoji: { name: emojiName } } = reaction;

    const shouldHaveHandlerFn: boolean = Object.values<string>(ReactionName)
      .includes(emojiName);

    if (!shouldHaveHandlerFn) {
      return;
    }

    const handlerFn: ReactionFunction = reactionInterfaceMap[emojiName];

    if (!handlerFn) {
      return logger.error(`No handler for reaction ${emojiName}`);
    }

    const fullReaction: MessageReaction = reaction.partial
      ? await fetchFull<MessageReaction>(reaction)
      : reaction as MessageReaction;

    const fullUser: User = user.partial
      ? await fetchFull<User>(user, true)
      : user as User;

    if (!(fullReaction && fullUser)) {
      await user.send(replyBuilder.internalError().content);
      return;
    }

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

/**
 * Registers client event listeners and calls commands.
 *
 * @param {Client}  client - Reference to client object.
 * @param {boolean} debug  - Whether client debug events are logged.
 */
const register = (client: Client, debug?: boolean): void => {
  if (debug) {
    client.on('debug', logger.debug);
  }

  client.on('warn', logger.warn);
  client.on('error', logger.error);

  client.on('interactionCreate', onInteractionCreate(client));
  client.on('messageDelete', onMessageDelete(client));
  client.on('messageReactionAdd', onMessageReactionAdd(client));
};

export default { register };
