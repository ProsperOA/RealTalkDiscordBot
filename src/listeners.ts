import { find } from 'lodash';
import { CacheType, Client, Interaction } from 'discord.js';

import commands, { Command } from './commands';

const getCommand = (commandName: string): any =>
  find(commands, { name: commandName });

export const register = (client: Client): void => {

  client.on('interactionCreate', async (interaction: Interaction<CacheType>) => {
    if (!interaction.isCommand()) {
      return;
    }

    const command: Command = getCommand(interaction.commandName);
    await (interaction as any)[command.func](command.arg);
  });

};
