import { Client, CommandInteraction, User } from 'discord.js';
import { Routes } from 'discord-api-types/v9';
import { REST } from '@discordjs/rest';

import * as listeners from './listeners';
import commands from './commands';
import db from '../db';
import { listAllRealTalkReply, realTalkReply } from './reply-builder';
import { useThrottle } from './middleware';

import {
  extractUserIdFromMention,
  findUser,
  getUsers,
  isDev,
  isMention,
  logger,
} from '../utils';

const { CLIENT_ID, CLIENT_TOKEN, GUILD_ID } = process.env;

const rest: REST = new REST({ version: '9' }).setToken(CLIENT_TOKEN);

export const THROTTLE_DURATION: Readonly<number> = isDev ? 0 : 30_000;
export type CommandFunction =
  (client: Client, interaction: CommandInteraction) => Promise<void>;

let isInitialized: boolean = false;

/**
 * Throws error if isInitialized is false.
 *
 * @throws {Error}
 */
const checkInit = (): void => {
  if (!isInitialized) {
    throw new Error('Cannot use commands before initializing command interface');
  }
};

/**
 * Handles the realtalk command.
 *
 * @param {Client}             client      - Reference to Client object.
 * @param {CommandInteraction} interaction - Reference to CommandInteraction object.
 */
const realTalk = async (
  client: Client,
  interaction: CommandInteraction
): Promise<void> => {
  checkInit();

  const targetUsername: string = interaction.options.get('who', true).value as string;
  const userFinder = findUser(getUsers(client));

  const targetUser: User = isMention(targetUsername)
    ? userFinder({ id: extractUserIdFromMention(targetUsername) })
    : userFinder({ username: targetUsername });

  if (!targetUser) {
    interaction.reply(realTalkReply.fail(targetUsername));
    return;
  }

  // smh... 🤦🏿‍♂️
  const statement: string = interaction.options.get('what', true).value as string;
  const incriminatingEvidence: string = realTalkReply.success(
    targetUser.id,
    statement
  );

  await interaction.reply(incriminatingEvidence);
  const message = await interaction.fetchReply() as any;

  await db.createStatement({
    user_id: interaction.user.id,
    accused_user_id: targetUser.id,
    created_at: new Date(),
    content: statement,
    link: message.url,
  });
};

/**
 * Handles the realtalk-list command.
 *
 * @param {Client}             client      - Reference to Client object.
 * @param {CommandInteraction} interaction - Reference to CommandInteraction object.
 */
const listAllRealTalk = async (
  client: Client,
  interaction: CommandInteraction
): Promise<void> => {
  checkInit();

  const statements = await db.getAllStatements();
  const reply: string = listAllRealTalkReply.success(statements);

  await interaction.reply(reply);
};

/**
 * Initializes slash commands and registers the client listeners.
 *
 * @param   {Client}       client - Reference to Client object.
 * @returns {Promise<any>}
 */
const init = async (client: Client): Promise<any> => {
  try {
    logger.info('Started refreshing application (/) commands.');

    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });

    logger.info('Successfully reloaded application (/) commands.');

    logger.info(`Active Middleware:
      useThrottle (${THROTTLE_DURATION}ms) /realtalk`);

    listeners.register(client, isDev);
    isInitialized = true;
  } catch (error) {
    logger.error(error);
  }
};

export default {
  init,

  'realtalk':      useThrottle(realTalk, THROTTLE_DURATION),
  'realtalk-list': listAllRealTalk,
};
