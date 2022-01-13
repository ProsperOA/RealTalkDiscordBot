import { Client, CommandInteraction } from 'discord.js';
import { isEmpty } from 'lodash';

import { commandInterfaceMap, THROTTLE_DURATION } from './index';
import { logger } from '../utils';

export interface MiddlewareOptions {
  Middleware: {[name: string]: string};
}

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
const logInteraction = (interaction: CommandInteraction): void => {
    const middleware: {[name: string]: string} = {};

    if (THROTTLE_DURATION) {
      middleware.useThrottle = `${THROTTLE_DURATION}ms`;
    }

    const options: MiddlewareOptions = isEmpty(middleware) ? null : {
      Middleware: middleware
    };

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
    if (!interaction.isCommand()) {
      return;
    }

    if (debug) {
      logInteraction(interaction);
    }

    await commandInterfaceMap[interaction.commandName](client, interaction);
  });

};
