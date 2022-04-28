import * as Jimp from "jimp";
import * as fs from "fs";
import { ApiResponse as UnsplashApiResponse } from "unsplash-js/dist/helpers/response";
import { Random as RandomPhoto } from "unsplash-js/dist/methods/photos/types";
import { RandomParams } from "unsplash-js/dist/methods/photos";
import { isArray, isEmpty, takeRightWhile } from "lodash";

import {
  Client,
  CollectorFilter,
  CommandInteraction,
  GuildMember,
  InteractionReplyOptions,
  Message,
  MessageCollector,
  User,
  VoiceChannel,
} from "discord.js";

import db from "../../../db";
import replies from "../../replies";
import { RealTalkCommand, RealTalkSubcommand } from "../../slash-commands";
import { useThrottle } from "../../middleware";
import { unsplash } from "../../../index";

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
  getMember,
  isMention,
  logger,
  getChannel,
  nicknameMention,
  getUser,
  delayDeleteReply,
} from "../../../utils";

export type InteractionCreateHandler = (client: Client, interaction: CommandInteraction, ...args: any[]) => Promise<void>;

enum MaxContentLength {
  InteractionOption = 140,
  ResponseBody = 2000,
}

const THROTTLE_DURATION: Readonly<number> = Config.IsDev ? 0 : Time.Second * 30;
const realTalkQuizCache: Cache = cache.new("realTalkQuizCache");

const hasValidContentLength = (str: string, type: keyof typeof MaxContentLength): boolean =>
  str.length <= MaxContentLength[type];

const getRealTalkWitnesses = async (channelId: string): Promise<User[]> =>
  (await getChannel(channelId) as VoiceChannel)
    ?.members
    .filter(({ voice }) => !voice.serverDeaf && !voice.selfDeaf)
    .map(({ user }) => user)
    .filter(user => !user.bot)
    ?? null;

const realTalkRecord = async (client: Client, interaction: CommandInteraction, requireWitnesses: boolean = true): Promise<void> => {
  const targetUserId: string = interaction.options.get("who", true).value as string;

  if (targetUserId === client.user.id) {
    return interaction.reply(replies.noRealTalkingMe());
  }

  const member: GuildMember = getMember(interaction.user.id);

  const witnesses: Partial<StatementWitnessRecord>[] = (await getRealTalkWitnesses(member.voice.channelId))
    ?.filter(user => user.id !== interaction.user.id)
    .map(user => ({ userId: user.id }))
    ?? [];

  if (!Config.IsDev && (requireWitnesses && isEmpty(witnesses))) {
    return interaction.reply(replies.realTalkNoWitnesses());
  }

  const statement: string = (interaction.options.get("what", true).value as string)
    .trim();

  if (!hasValidContentLength(statement, "InteractionOption")) {
    return interaction.reply(
      replies.invalidStatementLength(MaxContentLength.InteractionOption)
    );
  }

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

const realTalkHistory = async (_client: Client, interaction: CommandInteraction): Promise<void> => {
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

const realTalkStats = async (_client: Client, interaction: CommandInteraction): Promise<void> => {
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

const realTalkQuiz = async (_client: Client, interaction: CommandInteraction): Promise<void> => {
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

const realTalkImage = async (_client: Client, interaction: CommandInteraction): Promise<void> => {
  await interaction.deferReply();

  let imageFile: Jimp;
  let font: any;
  const imagePath: string = "./image.jpeg";
  const imageHeight: number = 600;
  const imageWidth: number = 600;
  const imageFontSize: number = 32;

  const deleteReply: (interaction: CommandInteraction) => Promise<void> =
    delayDeleteReply(Time.Second * 5);

  const topic: string = interaction.options.get("topic")?.value as string ?? "";
  const unsplashPayload: RandomParams = { count: 1, query: topic };

  try {
    const res: UnsplashApiResponse<RandomPhoto | RandomPhoto[]> =
      await unsplash.photos.getRandom(unsplashPayload);

    if (res.status !== 200) {
      const message: string | InteractionReplyOptions = res.status === 404
        ? replies.noImagesFound(topic)
        : replies.internalError();

      await interaction.editReply(message);
      await deleteReply(interaction);
      return;
    }

    const unsplashPhoto: RandomPhoto = isArray(res.response) ? res.response[0] : res.response;
    imageFile = await Jimp.read(unsplashPhoto.urls.small);
    imageFile.resize(imageHeight, imageWidth);
    font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
  } catch (error) {
    logger.error(error);
    await interaction.editReply(replies.internalError());
    await deleteReply(interaction);
    return;
  }

  const accusedUserId: string = interaction.options.get("who")?.value as string;
  const statement: StatementRecord =
    await db.getRandomStatement(accusedUserId && { accusedUserId });

  imageFile.print(
    font,
    10,
    imageHeight / 2,
    statement.content,
    imageWidth - 10,
    imageHeight - (imageFontSize + 10),
  );

  imageFile.print(
    font,
    10,
    imageHeight - (imageFontSize + 10),
    `- ${getUser(statement.accusedUserId)?.username ?? nicknameMention(statement.accusedUserId)}`,
    imageWidth - 10,
    imageHeight + 10,
  );

  await imageFile.writeAsync(imagePath);
  await interaction.editReply({ files: [ imagePath ] });

  try {
    fs.unlinkSync(imagePath);
  } catch (error) {
    logger.error(error);
  }
};

export default {
  [RealTalkCommand.RealTalk]: async (client: Client, interaction: CommandInteraction, ...args: any[]): Promise<void> => {
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
      case RealTalkSubcommand.Image:
        return realTalkImage(client, interaction);
      default:
        logger.error(`${subcommand} is an invalid ${RealTalkCommand.RealTalk} subcommand`);
        return interaction.reply(replies.internalError());
    }
  },
};
