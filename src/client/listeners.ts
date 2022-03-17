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

import messageInterface from './messages';
import replyBuilder from './reply-builder';
import { CommandFunction, commandMap } from './commands';
import { ReactionFunction, reactionMap } from './reactions';
import { ReactionName } from './reactions/message-reactions';

import {
  CustomLogOptions,
  CustomLogData,
  CustomMessageReaction,
  logger,
  Timer,
  timer,
  completeStructure,
} from '../utils';

const logCustom = (data: CustomLogData, responseTime: number): void => {
  const options: CustomLogOptions = {
    'Response Time': `${responseTime}ms`,
  };

  logger.custom(data, options);
};

const onInteractionCreate = async (interaction: CommandInteraction): Promise<void> => {
  if (!interaction.isCommand()) {
    return;
  }

  const { commandName } = interaction;
  const handlerFn: CommandFunction = commandMap[commandName];

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
  if (message.type !== 'APPLICATION_COMMAND') {
    return;
  }

  const fullMessage: Message = await completeStructure<Message>(message);
  const deletedAt: Date = await messageInterface.onMessageDelete(fullMessage);

  if (deletedAt) {
    logger.info(`Message ${message.id} deleted at ${deletedAt.toISOString()}`);
  }
};

const onMessageReactionAdd = (client: Client) =>
  async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> => {
    const { emoji: { name: emojiName } } = reaction;

    const shouldHaveHandlerFn: boolean = Object.values<string>(ReactionName)
      .includes(emojiName);

    if (!shouldHaveHandlerFn) {
      return;
    }

    const handlerFn: ReactionFunction = reactionMap[emojiName];

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
    client.on('debug', logger.debug);
  }

  client.on('warn', logger.warn);
  client.on('error', logger.error);

  client.on('interactionCreate', onInteractionCreate);
  client.on('messageDelete', onMessageDelete);
  client.on('messageReactionAdd', onMessageReactionAdd(client));
};

export default { register };
