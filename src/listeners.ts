import { Client, CommandInteraction } from 'discord.js';

import commandInterface from './command-interface';

/**
 * Registers client listeners and calls commands.
 *
 * @param {Client} - Reference to client object.
 */
export const register = (client: Client): void => {

  client.on('interactionCreate', async (interaction: CommandInteraction) => {
    if (!interaction.isCommand()) {
      return;
    }

    await (commandInterface as any)[interaction.commandName](client, interaction);
  });

};
