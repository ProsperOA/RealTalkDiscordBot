import {
  Client,
  CommandInteraction,
  MessageInteraction,
  MessageReaction,
  PartialMessageReaction,
  User,
} from 'discord.js';

import replyBuilder from './reply-builder';
import { CommandFunction, commandInterfaceMap } from './command-interface';
import { InteractionOptions, logger, Timer, timer } from '../utils';
import { reactionInterfaceMap } from './reaction-interface';

/**
 * Adds a logger to an interaction.
 *
 * @param {CommandInteraction} interaction - Reference to interaction object.
 */
const logInteraction = (interaction: CommandInteraction | MessageInteraction, responseTime: number): void => {
    const options: InteractionOptions = {
      'Response Time': `${responseTime}ms`,
    };

    logger.interaction(interaction, options);
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

    logInteraction(interaction, t.time());
  };

const onMessageReactionAdd = (client: Client) =>
  async (reaction: MessageReaction | PartialMessageReaction, _user: User): Promise<void> => {
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        logger.error(error);
        await reaction.message.reply(replyBuilder.internalError());
        return;
      }
    }

      const t: Timer = timer();
      const { emoji, message: { interaction }} = reaction;

      t.start();
      await reactionInterfaceMap[emoji.name]?.(client, reaction);
      t.end();

      const customInteraction = {
        ...interaction,
        options: {
          data: [{
            type: 'EMOJI_REACTION',
            value: emoji.name,
          }]
        }
      };

      logInteraction(customInteraction, t.time());
  };

/**
 * Adds debug, warning, and error loggers to a client.
 *
 * @param {Client} client - Reference to client object.
 */
const addDebugLogger = (client: Client): void => {
  client.on('debug', logger.info);
  client.on('warn', logger.warn);
  client.on('error', logger.error);
};

/**
 * Registers client event listeners and calls commands.
 *
 * @param {Client}  client - Reference to client object.
 * @param {boolean} debug  - Whether client debug events are logged.
 */
const register = (client: Client, debug?: boolean): void => {
  if (debug) {
    addDebugLogger(client);
  }

  client.on('interactionCreate', onInteractionCreate(client));
  client.on('messageReactionAdd', onMessageReactionAdd(client));
};

export default { register };
