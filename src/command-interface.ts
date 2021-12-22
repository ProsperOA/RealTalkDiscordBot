import { Client } from 'discord.js';
import { Routes } from 'discord-api-types/v9';
import { REST } from '@discordjs/rest';

import commands from './commands';
import * as listeners from './listeners';

const { CLIENT_ID, CLIENT_TOKEN, GUILD_ID } = process.env;

const rest: REST = new REST({ version: '9' }).setToken(CLIENT_TOKEN!);
const cleanedCommands = commands.map(({ name, description }) => ({
  name,
  description,
}));

export const init = async (client: Client): Promise<any> => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(Routes.applicationGuildCommands(CLIENT_ID!, GUILD_ID!), {
      body: cleanedCommands,
    });

    listeners.register(client);

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
};
