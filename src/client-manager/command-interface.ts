import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { isEmpty, takeRightWhile, trim, words } from 'lodash';

import {
  Client,
  CollectorFilter,
  CommandInteraction,
  Message,
  MessageCollector,
} from 'discord.js';

import db from '../db';
import listeners from './listeners';
import replyBuilder from './reply-builder';
import commands, { RealTalkCommand, RealTalkSubcommand } from './commands';
import { StatementWitnessRecord } from '../db/models/statement-witnesses';
import { useThrottle } from './middleware';

import {
  RealTalkQuizRecord,
  RealTalkStats,
  RealTalkStatsCompact,
  StatementRecord,
} from '../db/models/statements';

import {
  Config,
  extractUserIdFromMention,
  getActiveUsersInChannel,
  isMention,
  logger,
  Time,
} from '../utils';

export type CommandFunction =
  (client: Client, interaction: CommandInteraction, ...args: any[]) => Promise<void>;

interface CommandInterfaceMap {
  [commandName: string]: CommandFunction;
}

const { CLIENT_ID, CLIENT_TOKEN, GUILD_ID } = process.env;
const rest: REST = new REST({ version: '9' }).setToken(CLIENT_TOKEN);

enum MaxContentLength {
  InteractionOption = 140,
  ResponseBody = 2000,
}

const THROTTLE_DURATION: Readonly<number> = Config.IsDev ? 0 : Time.Second * 30;

let isInitialized: boolean = false;

/**
 * Throws error if isInitialized is false.
 *
 * @throws {Error}
 */
const checkInit = async (interaction: CommandInteraction): Promise<void> => {
  if (isInitialized) {
    return;
  }

  await interaction.reply(replyBuilder.internalError());

  logger.error('Cannot use commands before initializing command interface');
  process.kill(process.pid, 'SIGTERM');
};

const hasValidContentLength = (str: string, type: keyof typeof MaxContentLength): boolean =>
  str.length <= MaxContentLength[type];

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

  if (!Config.IsDev && (requireWitnesses && isEmpty(witnesses))) {
    return interaction.reply(replyBuilder.realTalkNoWitnesses());
  }

  const statement: string = interaction.options.get('what', true).value as string;

  if (!hasValidContentLength(statement, 'InteractionOption')) {
    return interaction.reply(
      replyBuilder.invalidStatementLength(MaxContentLength.InteractionOption)
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

    return hasValidContentLength(
      replyBuilder.realTalkHistory(statementsAcc),
      'ResponseBody'
    );
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
  const stats: RealTalkStats = await db.getStatementStats();
  const message: string = replyBuilder.realTalkStats(stats);

  if (!hasValidContentLength(message, 'ResponseBody')) {
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
 * Handles the realtalk quiz subcommand.
 *
 * @param {Client}             _client     - Reference to Client object.
 * @param {CommandInteraction} interaction - Reference to CommandInteraction object.
 */
const realTalkQuiz = async (_client: Client, interaction: CommandInteraction): Promise<void> => {
  const responseTimeout: number = Time.Second * 30;
  const statement: RealTalkQuizRecord = await db.getRandomStatement();

  await interaction.reply(
    replyBuilder.realTalkQuiz(statement.content, responseTimeout)
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

    listeners.register(client, Config.IsDev);
    isInitialized = true;
  } catch (error) {
    logger.error(error);
    process.kill(process.pid, 'SIGTERM');
  }
};

export const commandInterfaceMap: CommandInterfaceMap = {
  [RealTalkCommand.RealTalk]: async (client: Client, interaction: CommandInteraction, ...args: any[]): Promise<void> => {
    await checkInit(interaction);
    const subcommand: string = interaction.options.getSubcommand(true);

    switch(subcommand) {
      case RealTalkSubcommand.Record:
        return useThrottle(realTalkRecord, THROTTLE_DURATION)(client, interaction);
      case RealTalkSubcommand.RecordBase:
        return realTalkRecord(client, interaction, ...args);
      case RealTalkSubcommand.History:
        return realTalkHistory(client, interaction);
      case RealTalkSubcommand.Stats:
        return realTalkStats(client, interaction);
      case RealTalkSubcommand.Quiz:
        return realTalkQuiz(client, interaction);
      default:
        logger.error(`${subcommand} is an invalid ${RealTalkCommand.RealTalk} subcommand`);
        return interaction.reply(replyBuilder.internalError());
    }
  },
};

export default { init };
