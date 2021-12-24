import { find } from 'lodash';
import { Client, CommandInteraction, User } from 'discord.js';
import { Routes } from 'discord-api-types/v9';
import { memberNicknameMention, time } from '@discordjs/builders';
import { REST } from '@discordjs/rest';

import * as listeners from './listeners';
import commands from './commands';
import { getUsers } from './helpers';

const { CLIENT_ID, CLIENT_TOKEN, GUILD_ID } = process.env;

const rest: REST = new REST({ version: '9' }).setToken(CLIENT_TOKEN);

/**
 * Tests whether a tag is in nickname mention format.
 *
 * @param   {string} mention - tag to test.
 * @returns {boolean}
 */
const isNicknameMention = (mention: string): boolean =>
  /^<@![0-9]{18}>$/.test(mention);

/**
 * Extracts a user id from nickname mention.
 *
 * @param   {string} mention - user tag to format.
 * @returns {string}
 */
const extractUserIdFromNicknameMention = (mention: string): string =>
  mention.slice(3).slice(0, -1);

/**
 * Curried function that returns a {User} matching a filter.
 *
 * @param   {User[]} users  - List of users.
 * @param   {object} filter - Key/value to filter by.
 * @returns {User}
 */
const findUser = (users: User[]) => (filter: object) =>
  find(users, filter) as User;

/**
 * Handles the realtalk command.
 *
 * @param {Client}             client      - Reference to Client object.
 * @param {CommandInteraction} interaction - Reference to CommandInteraction object.
 */
const realTalk = (client: Client, interaction: CommandInteraction): void => {
  const targetUsername: string = interaction.options.get('who', true).value as string;
  console.log({ targetUsername })
  const userFinder = findUser(getUsers(client));

  const targetUser: User = isNicknameMention(targetUsername)
    ? userFinder({ id: extractUserIdFromNicknameMention(targetUsername) })
    : userFinder({ username: targetUsername });

  if (!targetUser) {
    interaction.reply({
      content: `**#RealTalk**, ${targetUsername} doesn't exist in this server.`,
      ephemeral: true,
    });

    return;
  }

  // smh... 🤦🏿‍♂️
  const statement: string = interaction.options.get('what').value as string;
  const incriminatingEvidence: string =
    `**The following is provided under the terms of #RealTalk**
    Date: ${time(new Date())}
    ${memberNicknameMention(targetUser.id)}: _"${statement}"_`


  interaction.reply(incriminatingEvidence);
};

/**
 * Initializes slash commands and registers the client listeners.
 *
 * @param   {Client}       client - Reference to Client object.
 * @returns {Promise<any>}
 */
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
