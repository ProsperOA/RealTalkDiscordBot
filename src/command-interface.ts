import { find } from 'lodash';
import { Client, CommandInteraction, User } from 'discord.js';
import { Routes } from 'discord-api-types/v9';
import { REST } from '@discordjs/rest';

import * as listeners from './listeners';
import commands from './commands';
import { getUsers } from './helpers';

const { CLIENT_ID, CLIENT_TOKEN, GUILD_ID } = process.env;

const rest: REST = new REST({ version: '9' }).setToken(CLIENT_TOKEN);

const USER_TAG_REGEX: RegExp = /^<@!/;

const getTimestamp = (): string => {
  const parts = new Date().toLocaleString().split(':');
  const suffix = parts.pop().split(' ')[1];

  return `${parts.join(':')} ${suffix}`;
};

const isUserTag = (tag: string): boolean => USER_TAG_REGEX.test(tag);

const cleanUserTag = (tag: string): string => tag.slice(3).slice(0, -1);

const buildMentionTagFromUserId = (id: string): string => `<@${id}>`;

const findUser = (users: User[]) => (filter: object) =>
  find(users, filter) as User;

const realTalk = (client: Client, interaction: CommandInteraction): void => {
  const targetUsername: string = interaction.options.get('who', true).value as string;
  const userFinder = findUser(getUsers(client));

  const targetUser: User = isUserTag(targetUsername)
    ? userFinder({ id: cleanUserTag(targetUsername) })
    : userFinder({ username: targetUsername });

  if (!targetUser) {
    interaction.reply({
      content: `**#RealTalk**, ${targetUsername} doesn't exist in this server.`,
      ephemeral: true,
    });

    return;
  }

  const timestamp: string = getTimestamp();
  const statement: string = interaction.options.get('what').value as string;

  // smh... 🤦🏿‍♂️
  const incriminatingEvidence: string = `**The following is provided under the terms of #RealTalk**
    Date: ${timestamp}
    ${buildMentionTagFromUserId(targetUser.id)}: "${statement}"`;

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
