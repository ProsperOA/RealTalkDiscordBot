import { Client, CommandInteraction, User } from 'discord.js';
import { Routes } from 'discord-api-types/v9';
import { REST } from '@discordjs/rest';
import { takeRightWhile } from 'lodash';

import * as listeners from './listeners';
import commands from './commands';
import db from '../db';
import { getUser, isDev, logger } from '../utils';
import { listAllRealTalkReply, realTalkReply } from './reply-builder';
import { StatementRecord } from '../db/models/statements';
import { useThrottle } from './middleware';

export type CommandFunction =
  (client: Client, interaction: CommandInteraction) => Promise<void>;

const { CLIENT_ID, CLIENT_TOKEN, GUILD_ID } = process.env;

const rest: REST = new REST({ version: '9' }).setToken(CLIENT_TOKEN);

export const COMMAND_OPTION_REQUEST_CONTENT_LENGTH: Readonly<number> = 140;
// DiscordAPI limit
const RESPONSE_BODY_CONTENT_LENGTH: Readonly<number> = 2000;
export const THROTTLE_DURATION: Readonly<number> = isDev ? 0 : 30_000;

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
 * Checks whether user input has an acceptable length.
 *
 * @param   {string}  input - user command option input.
 * @returns {boolean}
 */
const isValidCommandOptionLength = (input: string): boolean =>
  input.length <= COMMAND_OPTION_REQUEST_CONTENT_LENGTH;

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

  const statement: string = interaction.options.get('what', true).value as string;

  if (!isValidCommandOptionLength(statement)) {
    interaction.reply(realTalkReply.invalidContentLength());
    return;
  }

  const targetUserId: string = interaction.options.get('who', true).value as string;
  const targetUser: User = getUser(client, targetUserId);

  // smh... 🤦🏿‍♂️
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

  const statementsAcc: StatementRecord[] = [];
  const allStatements: StatementRecord[] = await db.getAllStatements();

  const statementsSlice: StatementRecord[] = takeRightWhile(allStatements, s => {
    statementsAcc.push(s);
    const contentLength: number = listAllRealTalkReply.success(statementsAcc).length;

    return contentLength < RESPONSE_BODY_CONTENT_LENGTH;
  });

  await interaction.reply(
    listAllRealTalkReply.success(statementsSlice)
  );
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
