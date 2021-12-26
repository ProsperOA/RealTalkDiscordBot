import { Client, CommandInteraction } from 'discord.js';

import commandInterface from './command-interface';
import { logger } from './utils';

/**
 * Logs general debug output from client.
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

  client.on('interactionCreate', async (interaction: CommandInteraction) => {
    if (!interaction.isCommand()) {
      return;
    }

    if (debug) {
      logger.interaction(interaction);
    }

    await (commandInterface as any)[interaction.commandName](client, interaction);
  });

};
