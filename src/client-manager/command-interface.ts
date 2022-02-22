import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { isEmpty, takeRightWhile, trim, words } from 'lodash';

import {
  Client,
  CollectorFilter,
  CommandInteraction,
  CommandInteractionOption,
  Message,
  MessageCollector,
} from 'discord.js';

import db from '../db';
import listeners from './listeners';
import replyBuilder from './reply-builder';
import { RealTalkQuizRecord, RealTalkStats, RealTalkStatsCompact, StatementRecord } from '../db/models/statements';
import { StatementWitnessRecord } from '../db/models/statement-witnesses';
import { extractUserIdFromMention, getActiveUsersInChannel, isDev, isMention, logger } from '../utils';
import { useThrottle } from './middleware';

import commands, {
  COMMAND_REAL_TALK,
  SUBCOMMAND_REAL_TALK_HISTORY,
  SUBCOMMAND_REAL_TALK_QUIZ,
  SUBCOMMAND_REAL_TALK_RECORD,
  SUBCOMMAND_REAL_TALK_STATS
} from './commands';

export type CommandFunction =
  (client: Client, interaction: CommandInteraction, ...args: any[]) => Promise<void>;
interface CommandInterfaceMap {
  [commandName: string]: CommandFunction;
}

const { CLIENT_ID, CLIENT_TOKEN, GUILD_ID } = process.env;
const rest: REST = new REST({ version: '9' }).setToken(CLIENT_TOKEN);

const COMMAND_OPTION_CONTENT_LENGTH: Readonly<number> = 140;
const RESPONSE_BODY_CONTENT_LENGTH: Readonly<number> = 2000;
export const THROTTLE_DURATION: Readonly<number> = isDev ? 0 : 30000;

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
const getSubCommand = (interaction: CommandInteraction): CommandInteractionOption => {
  const option: CommandInteractionOption =  interaction.options.data[0];
  return option.type === 'SUB_COMMAND' ? option : null;
};

/**
 * Handles the realtalk command.
 *
 * @param {Client}             _client     - Reference to Client object.
 * @param {CommandInteraction} interaction - Reference to CommandInteraction object.
 */
const realTalkRecord = async (_client: Client, interaction: CommandInteraction, requireWitnesses: boolean = true): Promise<void> => {
  const witnesses: Partial<StatementWitnessRecord>[] = getActiveUsersInChannel(interaction.channelId)
    .filter(user => user.id !== interaction.user.id)
    .map(user => ({ user_id: user.id }));

  if (!isDev && (requireWitnesses && isEmpty(witnesses))) {
    return interaction.reply(replyBuilder.realTalkNoWitnesses());
  }

  const statement: string = interaction.options.get('what', true).value as string;

  if (!isValidCommandOptionLength(statement)) {
    return interaction.reply(
      replyBuilder.invalidStatementLength(COMMAND_OPTION_CONTENT_LENGTH)
    );
  }

  const targetUserId: string = interaction.options.get('who', true).value as string;
  const incriminatingEvidence: string = replyBuilder.realTalkRecord(
    targetUserId,
    statement
  );

  const message: Message =
    await interaction.reply({ content: incriminatingEvidence, fetchReply: true }) as Message;

  const statementRecord: StatementRecord = {
    user_id: interaction.user.id,
    accused_user_id: targetUserId,
    created_at: new Date(),
    content: statement,
    link: message.url,
  };

  await db.createStatement(statementRecord, witnesses);
};

/**
 * Handles the realtalk-list command.
 *
 * @param {Client}             _client     - Reference to Client object.
 * @param {CommandInteraction} interaction - Reference to CommandInteraction object.
 */
const realTalkHistory = async (_client: Client, interaction: CommandInteraction): Promise<void> => {
  const statementsAcc: StatementRecord[] = [];
  const allStatements: StatementRecord[] = await db.getAllStatements();

  const statementsSlice: StatementRecord[] = takeRightWhile(allStatements, s => {
    statementsAcc.push(s);
    return isValidContentLength(replyBuilder.realTalkHistory(statementsAcc));
  });

  return interaction.reply(replyBuilder.realTalkHistory(statementsSlice));
};

/**
 * Handles the realtalk stats subcommand.
 *
 * @param {Client}             _client     - Reference to Client object.
 * @param {CommandInteraction} interaction - Reference to CommandInteraction object.
 */
const realTalkStats = async (_client: Client, interaction: CommandInteraction): Promise<void> => {
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

  return interaction.reply(message);
};

/**
 * Handles the realtalk quiz subcommand.
 *
 * @param {Client}             _client     - Reference to Client object.
 * @param {CommandInteraction} interaction - Reference to CommandInteraction object.
 */
const realTalkQuiz = async (_client: Client, interaction: CommandInteraction): Promise<void> => {
  const responseTimeout: number = 30000;
  const statement: RealTalkQuizRecord = await db.getRandomStatement();

  await interaction.reply(
    replyBuilder.realTalkQuiz(statement.content, responseTimeout / 1000)
  );

  const filter: CollectorFilter<[Message<boolean>]> =
    (message: Message) => message.content.startsWith('#RealTalk');
  const collector: MessageCollector =
    interaction.channel.createMessageCollector({ filter, time: responseTimeout });

  const correctAnswerUserIds: string[] = [];

  collector.on('collect', message => {
    const { content } = message;

    const mention: string = words(trim(content))[1];
    const userId: string = extractUserIdFromMention(mention);
    const isValidMention: boolean = mention && isMention(mention);
    const isCorrectUserId: boolean = userId === statement.accused_user_id;

    if (isValidMention && isCorrectUserId) {
      correctAnswerUserIds.push(message.author.id);
    }
  });

  collector.on('end', async () => {
    await interaction.followUp(
      replyBuilder.realTalkQuizEnd(statement.accused_user_id, correctAnswerUserIds)
    );
  });
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

export const commandInterfaceMap: CommandInterfaceMap = {
  [COMMAND_REAL_TALK]: async (client: Client, interaction: CommandInteraction, ...args: any[]) => {
    checkInit();
    const subcommand: string | null = getSubCommand(interaction)?.name;

    switch(subcommand) {
      case SUBCOMMAND_REAL_TALK_RECORD:
        return useThrottle(realTalkRecord, THROTTLE_DURATION)(client, interaction, ...args);
      case SUBCOMMAND_REAL_TALK_HISTORY:
        return realTalkHistory(client, interaction);
      case SUBCOMMAND_REAL_TALK_STATS:
        return realTalkStats(client, interaction);
      case SUBCOMMAND_REAL_TALK_QUIZ:
        return realTalkQuiz(client, interaction);
      default:
        logger.error(`${subcommand} is an invalid ${COMMAND_REAL_TALK} subcommand`);
        return interaction.reply(replyBuilder.internalError());
    }
  },
};

export default { init };
