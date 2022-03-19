import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { isEmpty, takeRightWhile } from 'lodash';

import {
  CollectorFilter,
  CommandInteraction,
  GuildMember,
  Message,
  MessageCollector,
} from 'discord.js';

import db from '../../db';
import replyBuilder from '../reply-builder';
import slashCommands, { RealTalkCommand, RealTalkSubcommand } from './slash-commands';
import { StatementWitnessRecord } from '../../db/models/statement-witnesses';
import { useThrottle } from '../middleware';

import {
  RealTalkQuizRecord,
  RealTalkStats,
  RealTalkStatsCompact,
  StatementRecord,
} from '../../db/models/statements';

import {
  AnyFunction,
  cache,
  Cache,
  Config,
  extractUserIdFromMention,
  getActiveUsersInChannel,
  getMember,
  isMention,
  logger,
  Time,
} from '../../utils';

export type CommandFunction = (interaction: CommandInteraction, ...args: any[]) => Promise<void>;

interface CommandMap {
  [commandName: string]: CommandFunction;
}

const { CLIENT_ID, CLIENT_TOKEN, GUILD_ID } = process.env;
const rest: REST = new REST({ version: '9' }).setToken(CLIENT_TOKEN);

enum MaxContentLength {
  InteractionOption = 140,
  ResponseBody = 2000,
}

const THROTTLE_DURATION: Readonly<number> = Config.IsDev ? 0 : Time.Second * 30;
const realTalkQuizCache: Cache = cache.new('realTalkQuizCache');

const hasValidContentLength = (str: string, type: keyof typeof MaxContentLength): boolean =>
  str.length <= MaxContentLength[type];

const realTalkRecord = async (interaction: CommandInteraction, requireWitnesses: boolean = true): Promise<void> => {
  const member: GuildMember = getMember(interaction.user.id);

  const witnesses: Partial<StatementWitnessRecord>[] = getActiveUsersInChannel(member.voice.channelId)
    ?.filter(user => user.id !== interaction.user.id)
    .map(user => ({ userId: user.id }))
    ?? [];

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

  const statementRecord: Partial<StatementRecord> = {
    accusedUserId: targetUserId,
    content: statement,
    createdAt: interaction.createdAt,
    url: message.url,
    userId: interaction.user.id,
  };

  await db.createStatement(statementRecord, witnesses);
};

const realTalkHistory = async (interaction: CommandInteraction): Promise<void> => {
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

const realTalkStats = async (interaction: CommandInteraction): Promise<void> => {
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

const realTalkQuiz = async (interaction: CommandInteraction): Promise<void> => {
  const previousQuizTimeout: number = realTalkQuizCache.ttl('lastStatement');

  if (previousQuizTimeout) {
    return interaction.reply(replyBuilder.realTalkQuizActive(previousQuizTimeout));
  }

  let statement: RealTalkQuizRecord = await db.getRandomStatement();

  while (realTalkQuizCache.isEqual('lastStatement', statement)) {
    statement = await db.getRandomStatement();
  }

  const quizTimeout: number = Time.Second * 30;
  realTalkQuizCache.setF('lastStatement', statement, quizTimeout);

  await interaction.reply(
    replyBuilder.realTalkQuiz(statement.content, quizTimeout)
  );

  const filter: CollectorFilter<[Message<boolean>]> =
    (message: Message) => message.content.startsWith('#RealTalk');

  const collector: MessageCollector =
    interaction.channel.createMessageCollector({ filter, time: quizTimeout });

  const correctAnswerUserIds: string[] = [];

  collector.on('collect', message => {
    const { content } = message;

    const mention: string = content.trim().split(' ')[1] ?? '';
    const userId: string = extractUserIdFromMention(mention);
    const isValidMention: boolean = mention && isMention(mention);
    const isCorrectUserId: boolean = userId === statement.accusedUserId;

    if (isValidMention && isCorrectUserId) {
      correctAnswerUserIds.push(message.author.id);
    }
  });

  collector.on('end', async () => {
    await interaction.followUp(
      replyBuilder.realTalkQuizEnd(statement.accusedUserId, correctAnswerUserIds)
    );
  });
};

const init = async (cb?: AnyFunction): Promise<void> => {
  try {
    logger.info('Started refreshing application (/) commands.');

    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: slashCommands,
    });

    logger.info('Successfully reloaded application (/) commands.');

    cb?.();
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
};

export const commandMap: CommandMap = {
  [RealTalkCommand.RealTalk]: async (interaction: CommandInteraction, ...args: any[]): Promise<void> => {
    const subcommand: string = interaction.options.getSubcommand(true);

    switch(subcommand) {
      case RealTalkSubcommand.Record:
        return useThrottle(realTalkRecord, THROTTLE_DURATION)(interaction);
      case RealTalkSubcommand.RecordBase:
        return realTalkRecord(interaction, ...args);
      case RealTalkSubcommand.History:
        return realTalkHistory(interaction);
      case RealTalkSubcommand.Stats:
        return realTalkStats(interaction);
      case RealTalkSubcommand.Quiz:
        return realTalkQuiz(interaction);
      default:
        logger.error(`${subcommand} is an invalid ${RealTalkCommand.RealTalk} subcommand`);
        return interaction.reply(replyBuilder.internalError());
    }
  },
};

export default { init };
