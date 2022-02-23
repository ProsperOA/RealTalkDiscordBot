import {
  Client,
  CommandInteraction,
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
} from 'discord.js';

import * as reactions from './reactions';
import replyBuilder from './reply-builder';
import { CommandFunction, commandInterfaceMap } from './command-interface';
import { ReactionFunction, reactionInterfaceMap } from './reaction-interface';

import {
  CustomLogOptions,
  CustomLogData,
  CustomMessageReaction,
  logger,
  Timer,
  timer,
  fetchFull,
} from '../utils';

type EventListener = (...args: any[]) => Promise<void>;

const logCustom = (data: CustomLogData, responseTime: number): void => {
  const options: CustomLogOptions = {
    'Response Time': `${responseTime}ms`,
  };

  logger.custom(data, options);
};

const onInteractionCreate = (client: Client): EventListener =>
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

const onMessageReactionAdd = (client: Client): EventListener =>
  async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> => {
    const { emoji: { name: emojiName } } = reaction;

    const shouldHaveHandlerFn: boolean = Boolean(
      Object.values(reactions).find(value => value === emojiName)
    );

    if (!shouldHaveHandlerFn) {
      return;
    }

    const handlerFn: ReactionFunction = reactionInterfaceMap[emojiName];

    if (!handlerFn) {
      return logger.error(`No handler for reaction ${emojiName}`);
    }

    let fullReaction: MessageReaction = null;
    let fullUser: User = null;

    try {
      fullReaction = await fetchFull<MessageReaction>(reaction);
      fullUser = await fetchFull<User>(user, true);
    } catch (error) {
      return logger.error(error);
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
  client.on('messageReactionAdd', onMessageReactionAdd(client));
};

export default { register };
