import { Client, CommandInteraction } from 'discord.js';

import { commandInterfaceMap, THROTTLE_DURATION } from './index';
import { InteractionOptions, logger, Timer, timer } from '../utils';

/**
 * Adds a logger to an interaction.
 *
 * @param {CommandInteraction} interaction - Reference to interaction object.
 */
const logInteraction = async (interaction: CommandInteraction, responseTime: number): Promise<void> => {
    const options: InteractionOptions = {
      'Middleware': 'N/A',
      'Response Time': `${responseTime}ms`,
    };

    if (THROTTLE_DURATION) {
      options.Middleware.useThrottle = `${THROTTLE_DURATION}ms`;
    }

    logger.interaction(interaction, options);
};

const onInteractionCreate = (client: Client, debug?: boolean) =>
  async (interaction: CommandInteraction): Promise<void> => {
    if (!interaction.isCommand()) {
      return;
    }

    const t: Timer = timer();

    t.start();
    await commandInterfaceMap[interaction.commandName](client, interaction);
    t.end();

    if (debug) {
      await logInteraction(interaction, t.time());
    }
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
export const register = (client: Client, debug?: boolean): void => {
  if (debug) {
    addDebugLogger(client);
  }

  client.on('interactionCreate', onInteractionCreate(client, debug));
};
