import { Client, CommandInteraction, CommandInteractionOption, Message } from 'discord.js';
import { Routes } from 'discord-api-types/v9';
import { REST } from '@discordjs/rest';
import { takeRightWhile } from 'lodash';

import * as listeners from './listeners';
import db from '../db';
import replyBuilder from './reply-builder';
import { isDev, logger } from '../utils';
import { RealTalkStats, RealTalkStatsCompact, StatementRecord } from '../db/models/statements';
import { useThrottle } from './middleware';

import commands, {
  COMMAND_REAL_TALK,
  SUBCOMMAND_REAL_TALK_HISTORY,
  SUBCOMMAND_REAL_TALK_RECORD,
  SUBCOMMAND_REAL_TALK_STATS
} from './commands';

export type CommandFunction = (client: Client, interaction: CommandInteraction) => Promise<void>;

const { CLIENT_ID, CLIENT_TOKEN, GUILD_ID } = process.env;
const rest: REST = new REST({ version: '9' }).setToken(CLIENT_TOKEN);

const COMMAND_OPTION_CONTENT_LENGTH: Readonly<number> = 140;
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
  input.length <= COMMAND_OPTION_CONTENT_LENGTH;

/**
 * Checks whether a string has a valid content length.
 *
 * @param   {string}  str - string to check.
 * @returns {boolean}
 */
const isValidContentLength = (str: string): boolean =>
  str.length <= RESPONSE_BODY_CONTENT_LENGTH;

/**
 * Returns an interaction's subcommand.
 *
 * @param   {CommandInteraction} interaction - Reference to interaction object.
 * @returns {CommandInteractionOption}
 */
const getSubCommand = (interaction: CommandInteraction): CommandInteractionOption =>
  interaction.options.data[0];

/**
 * Handles the realtalk command.
 *
 * @param {Client}             _client     - Reference to Client object.
 * @param {CommandInteraction} interaction - Reference to CommandInteraction object.
 */
const realTalkRecord = async (_client: Client, interaction: CommandInteraction): Promise<void> => {
  checkInit();

  const statement: string = interaction.options.get('what', true).value as string;

  if (!isValidCommandOptionLength(statement)) {
    return interaction.reply(
      replyBuilder.invalidStatementLength(COMMAND_OPTION_CONTENT_LENGTH)
    );
  }

  const targetUserId: string = interaction.options.get('who', true).value as string;

  // smh... 🤦🏿‍♂️
  const incriminatingEvidence: string = replyBuilder.realTalkRecord(
    targetUserId,
    statement
  );

  await interaction.reply(incriminatingEvidence);
  const message: Message = await interaction.fetchReply() as Message;

  await db.createStatement({
    user_id: interaction.user.id,
    accused_user_id: targetUserId,
    created_at: new Date(),
    content: statement,
    link: message.url,
  });
};

/**
 * Handles the realtalk-list command.
 *
 * @param {Client}             _client     - Reference to Client object.
 * @param {CommandInteraction} interaction - Reference to CommandInteraction object.
 */
const realTalkHistory = async (_client: Client, interaction: CommandInteraction): Promise<void> => {
  checkInit();

  const statementsAcc: StatementRecord[] = [];
  const allStatements: StatementRecord[] = await db.getAllStatements();

  const statementsSlice: StatementRecord[] = takeRightWhile(allStatements, s => {
    statementsAcc.push(s);

    return isValidContentLength(replyBuilder.realTalkHistory(statementsAcc));
  });

  await interaction.reply(replyBuilder.realTalkHistory(statementsSlice));
};

/**
 * Handles the realtalk stats subcommand.
 *
 * @param {Client}             _client     - Reference to Client object.
 * @param {CommandInteraction} interaction - Reference to CommandInteraction object.
 */
const realTalkStats = async (_client: Client, interaction: CommandInteraction): Promise<void> => {
  checkInit();

  const stats: RealTalkStats = await db.getStatementStats();
  const message: string  = replyBuilder.realTalkStats(stats);

  if (!isValidContentLength(message)) {
    const compactStats: RealTalkStatsCompact = { uniqueUsers: 0, uses: 0 };

    Object.values(stats).forEach(({ uses }) => {
      if (uses) {
        compactStats.uniqueUsers += 1;
        compactStats.uses += uses;
      }
    });

    return interaction.reply(replyBuilder.realTalkStatsCompact(compactStats));
  }

  await interaction.reply(message);
};

/**
 * Initializes slash commands and registers the client listeners.
 *
 * @param   {Client}       client - Reference to Client object.
 * @returns {Promise<void>}
 */
const init = async (client: Client): Promise<void> => {
  try {
    logger.info('Started refreshing application (/) commands.');

    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });

    logger.info('Successfully reloaded application (/) commands.');

    listeners.register(client, isDev);
    isInitialized = true;
  } catch (error) {
    logger.error(error);
  }
};

export const commandInterfaceMap: {[command: string]: CommandFunction} = {
  [COMMAND_REAL_TALK]: async (client: Client, interaction: CommandInteraction) => {
    const subcommand: string = getSubCommand(interaction).name;

    switch(subcommand) {
      case SUBCOMMAND_REAL_TALK_RECORD:
        return useThrottle(realTalkRecord, THROTTLE_DURATION)(client, interaction);
      case SUBCOMMAND_REAL_TALK_HISTORY:
        return realTalkHistory(client, interaction);
      case SUBCOMMAND_REAL_TALK_STATS:
        return realTalkStats(client, interaction);
      default:
        logger.error(`${subcommand} is an invalid ${COMMAND_REAL_TALK} subcommand`);
        return interaction.reply(replyBuilder.internalError());
    }
  },
};

export default { init };
