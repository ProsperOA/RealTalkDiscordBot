import { Client, CommandInteraction } from 'discord.js';

import { commandInterfaceMap, THROTTLE_DURATION } from './index';
import { InteractionOptions, logger, Timer, timer } from '../utils';

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
 * Adds a logger to an interaction.
 *
 * @param {CommandInteraction} interaction - Reference to interaction object.
 */
const logInteraction = async (interaction: CommandInteraction, responseTime: number): Promise<void> => {
    const options: InteractionOptions = {
      'Middleware': 'N/A',
      'Reply': 'N/A',
      'Response Time': `${responseTime}ms`,
    };

    if (THROTTLE_DURATION) {
      options.Middleware.useThrottle = `${THROTTLE_DURATION}ms`;
    }

    logger.interaction(interaction, options);
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

  client.on('interactionCreate', async (interaction: CommandInteraction) => {
    const t: Timer = timer();
    t.start();

    if (!interaction.isCommand()) {
      return;
    }

    await commandInterfaceMap[interaction.commandName](client, interaction);
    const responseTime: number = t.end();

    if (debug) {
      await logInteraction(interaction, responseTime);
    }
  });

};
