import { isEmpty, takeRightWhile } from "lodash";

import {
  CollectorFilter,
  CommandInteraction,
  GuildMember,
  Message,
  MessageCollector,
} from "discord.js";

import db from "../../../db";
import replies from "../../replies";
import { RealTalkCommand, RealTalkSubcommand } from "../../slash-commands";
import { useThrottle } from "../../middleware";

import {
  RealTalkQuizRecord,
  RealTalkStats,
  RealTalkStatsCompact,
  StatementRecord,
  StatementWitnessRecord ,
} from "../../../db/models";

import {
  Cache,
  Config,
  Time,
  cache,
  extractUserIdFromMention,
  getActiveUsersInChannel,
  getMember,
  isMention,
  logger,
} from "../../../utils";

export type InteractionCreateHandler = (interaction: CommandInteraction, ...args: any[]) => Promise<void>;

enum MaxContentLength {
  InteractionOption = 140,
  ResponseBody = 2000,
}

const THROTTLE_DURATION: Readonly<number> = Config.IsDev ? 0 : Time.Second * 30;
const realTalkQuizCache: Cache = cache.new("realTalkQuizCache");

const hasValidContentLength = (str: string, type: keyof typeof MaxContentLength): boolean =>
  str.length <= MaxContentLength[type];

const realTalkRecord = async (interaction: CommandInteraction, requireWitnesses: boolean = true): Promise<void> => {
  const member: GuildMember = getMember(interaction.user.id);

  const witnesses: Partial<StatementWitnessRecord>[] = getActiveUsersInChannel(member.voice.channelId)
    ?.filter(user => user.id !== interaction.user.id)
    .map(user => ({ userId: user.id }))
    ?? [];

  if (!Config.IsDev && (requireWitnesses && isEmpty(witnesses))) {
    return interaction.reply(replies.realTalkNoWitnesses());
  }

  const statement: string = interaction.options.get("what", true).value as string;

  if (!hasValidContentLength(statement, "InteractionOption")) {
    return interaction.reply(
      replies.invalidStatementLength(MaxContentLength.InteractionOption)
    );
  }

  const targetUserId: string = interaction.options.get("who", true).value as string;
  const incriminatingEvidence: string = replies.realTalkRecord(
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
      replies.realTalkHistory(statementsAcc),
      "ResponseBody"
    );
  });

  await interaction.reply(replies.realTalkHistory(statementsSlice));
};

const realTalkStats = async (interaction: CommandInteraction): Promise<void> => {
  const stats: RealTalkStats = await db.getStatementStats();
  const message: string = replies.realTalkStats(stats);

  if (!hasValidContentLength(message, "ResponseBody")) {
    const compactStats: RealTalkStatsCompact = { uniqueUsers: 0, uses: 0 };

    Object.values(stats).forEach(({ uses }) => {
      if (uses) {
        compactStats.uniqueUsers += 1;
        compactStats.uses += uses;
      }
    });

    return interaction.reply(replies.realTalkStatsCompact(compactStats));
  }

  await interaction.reply(message);
};

const realTalkQuiz = async (interaction: CommandInteraction): Promise<void> => {
  const previousTimeout: number = realTalkQuizCache.ttl("previousStatement");

  if (previousTimeout) {
    return interaction.reply(replies.realTalkQuizActive(previousTimeout));
  }

  let statement: RealTalkQuizRecord;

  do {
    statement = await db.getRandomStatement();
  } while (realTalkQuizCache.equals("previousStatement", statement));

  const quizTimeout: number = Time.Second * 30;
  realTalkQuizCache.setF("previousStatement", statement, quizTimeout);

  await interaction.reply(
    replies.realTalkQuiz(statement.content, quizTimeout)
  );

  const filter: CollectorFilter<[Message<boolean>]> =
    (message: Message) => message.content.startsWith("#RealTalk");

  const collector: MessageCollector =
    interaction.channel.createMessageCollector({ filter, time: quizTimeout });

  const correctAnswerUserIds: string[] = [];

  collector.on("collect", message => {
    const mention: string = message.content.trim().split(" ")[1];
    const userId: string = extractUserIdFromMention(mention);
    const isCorrectUserId: boolean = userId === statement.accusedUserId;

    if (isMention(mention) && isCorrectUserId) {
      correctAnswerUserIds.push(message.author.id);
    }
  });

  collector.on("end", async () => {
    await interaction.followUp(
      replies.realTalkQuizEnd(statement.accusedUserId, correctAnswerUserIds)
    );
  });
};

export default {
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
        return interaction.reply(replies.internalError());
    }
  },
};
