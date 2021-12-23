import { Client, CommandInteraction } from 'discord.js';
import { Routes } from 'discord-api-types/v9';
import { REST } from '@discordjs/rest';

import * as listeners from './listeners';
import commands from './commands';

const { CLIENT_ID, CLIENT_TOKEN, GUILD_ID } = process.env;

const rest: REST = new REST({ version: '9' }).setToken(CLIENT_TOKEN);

const realTalk = (client: Client, interaction: CommandInteraction) => {
  const today: string = new Date().toLocaleString();
  const targetUser: string = interaction.options.get('who').value as string;
  const statement: string = interaction.options.get('what').value as string;

  // smh... 🤦🏿‍♂️
  const incriminatingEvidence: string = `**The following is provided under the terms of #RealTalk**
    Date: ${today}
    ${targetUser}: "${statement}"`;

  interaction.reply(incriminatingEvidence);
};

const init = async (client: Client): Promise<any> => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });

    listeners.register(client);

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
};

export default {
  init,
  realtalk: realTalk,
};
