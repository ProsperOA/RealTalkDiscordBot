import {
  Client,
  CommandInteraction,
  MessageReaction,
  PartialMessageReaction,
  User,
} from 'discord.js';

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
} from '../utils';

const logCustom = (data: CustomLogData, responseTime: number): void => {
  const options: CustomLogOptions = {
    'Response Time': `${responseTime}ms`,
  };

  logger.custom(data, options);
};

const onInteractionCreate = (client: Client) =>
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
    t.end();

    logCustom({ interaction }, t.time());
  };

const onMessageReactionAdd = (client: Client) =>
  async (reaction: MessageReaction | PartialMessageReaction, user: User): Promise<void> => {
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        logger.error(error);
        return;
      }
    }

    const fullReaction: MessageReaction = reaction as MessageReaction;
    const handlerFn: ReactionFunction = reactionInterfaceMap[fullReaction.emoji.name];

    if (handlerFn) {
      const t: Timer = timer();

      t.start();
      await handlerFn(client, user, fullReaction);
      t.end();

      const logData: CustomMessageReaction = {
        reaction: fullReaction,
        user,
      };

      logCustom({ messageReaction: logData }, t.time());
    }
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
