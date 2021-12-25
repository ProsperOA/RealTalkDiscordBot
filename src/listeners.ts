import { Client, CommandInteraction } from 'discord.js';

import commandInterface from './command-interface';

/**
 * Logs general debug output from client.
 *
 * @param {Client} client - Reference to client object.
 */
const addDebugLogger = (client: Client): void => {
  client.on('debug', (message: string) => {
    console.info('DEBUG', message);
  });

  client.on('warn', (message: string) => {
    console.warn('WARNING', message);
  });

  client.on('error', (error: Error) => {
    console.error('ERROR', error);
  });
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

    await (commandInterface as any)[interaction.commandName](client, interaction);
  });

};
