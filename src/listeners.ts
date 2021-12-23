import { Client, CommandInteraction } from 'discord.js';

import commandInterface from './command-interface';

export const register = (client: Client): void => {

  client.on('interactionCreate', async (interaction: CommandInteraction) => {
    if (!interaction.isCommand()) {
      return;
    }

    (commandInterface as any)[interaction.commandName](client, interaction);
  });

};
