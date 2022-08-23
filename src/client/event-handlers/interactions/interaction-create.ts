import * as fs from "fs";
import * as Canvas from "@napi-rs/canvas";
import fetch from "cross-fetch";
import { ApiResponse as UnsplashApiResponse } from "unsplash-js/dist/helpers/response";
import { Knex } from "knex";
import { Random as UnsplashRandomPhoto } from "unsplash-js/dist/methods/photos/types";
import { RandomParams as UnsplashRandomParams } from "unsplash-js/dist/methods/photos";
import { dropRight, flatten, isArray, isEmpty, sumBy, takeRightWhile, uniq, zip } from "lodash";

import {
  Client,
  CommandInteraction,
  GuildMember,
  InteractionReplyOptions,
  Message,
  MessageAttachment,
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
  getUserIdFromMention,
  logger,
  delayDeleteReply,
  getMember,
  wrapCanvasText,
  replaceMentions,
  getDisplayName,
} from "../../../utils";

export type InteractionCreateHandler = (client: Client, interaction: CommandInteraction, ...args: any[]) => Promise<void>;

enum MaxContentLength {
  InteractionOption = 255,
  ResponseBody = 2000,
}

const THROTTLE_DURATION: number = Config.IsDev ? 0 : Time.Second * 30;
const realTalkQuizCache: Cache = cache.new("realTalkQuizCache");

const hasValidContentLength = (str: string, type: keyof typeof MaxContentLength): boolean =>
  str.length <= MaxContentLength[type];

const getRealTalkWitnesses = async ({ channels }: Client, channelId: string): Promise<User[]> =>
  (await channels.fetch(channelId) as VoiceChannel)?.members
    .filter(({ voice }) => !voice.serverDeaf && !voice.selfDeaf)
    .map(({ user }) => user)
    .filter(user => !user.bot)
    ?? null;

const cleanStatement = (statement: string): string =>
  statement.trim().replace(/["]+/g, "");

const realTalkRecord = async (client: Client, interaction: CommandInteraction, requireWitnesses: boolean = true): Promise<void> => {
  const targetUser: User = interaction.options.getUser("who");

  if (targetUser.id === client.user.id) {
    return interaction.reply(replies.noRealTalkingMe());
  }

  let witnesses: Partial<StatementWitnessRecord>[];
  const { voice }: GuildMember = interaction.member as GuildMember;

  if (!Config.IsDev && requireWitnesses) {
    if (!voice.channelId) {
      return interaction.reply(replies.realTalkNotInVoiceChat());
    }

    witnesses = (await getRealTalkWitnesses(client, voice.channelId))
      .filter(user => user.id !== interaction.user.id)
      .map(user => ({ userId: user.id }));

    if (isEmpty(witnesses)) {
      return interaction.reply(replies.realTalkNoWitnesses());
    }
  }

  const statement: string = cleanStatement(interaction.options.getString("what"));

  if (!hasValidContentLength(statement, "InteractionOption")) {
    return interaction.reply(replies.invalidStatementLength(MaxContentLength.InteractionOption));
  }

  const incriminatingEvidence: string = replies.realTalkRecord(targetUser.id, statement);
  const message: Message = await interaction.reply({ content: incriminatingEvidence, fetchReply: true }) as Message;

  const statementRecord: Partial<StatementRecord> = {
    accusedUserId: targetUser.id,
    content: statement,
    createdAt: interaction.createdAt,
    url: message.url,
    userId: interaction.user.id,
  };

  await db.createStatement(statementRecord, witnesses);
};

const realTalkConvo = async (_client: Client, interaction: CommandInteraction): Promise<void> => {
  await interaction.deferReply();

  const deleteReply: (interaction: CommandInteraction) => Promise<void> =
    delayDeleteReply.bind(null, Time.Second * 5);

  const users: [User, User] = [
    interaction.options.getUser("user1", true),
    interaction.options.getUser("user2", true),
  ];

  const statementsGroup: StatementRecord[][] = [
    await db.getRandomStatement({ accusedUserId: users[0].id }, 3),
    await db.getRandomStatement({ accusedUserId: users[1].id }, 3),
  ];

  const noStatementsUserIds: string[] = [];

  statementsGroup.forEach((statements, i) => {
    if (!statements.length) {
      noStatementsUserIds.push(users[i].id);
    }
  });

  if (noStatementsUserIds.length) {
    await interaction.editReply(
      replies.realTalkNoStatements(uniq(noStatementsUserIds))
    );

    return deleteReply(interaction);
  }

  const maxStatementsPerUser: number = Math.min(statementsGroup[0].length, statementsGroup[1].length);
  const filteredStatementsGroup: StatementRecord[][] =
    statementsGroup.map(statements => dropRight(statements, statements.length - maxStatementsPerUser));

  const convo: StatementRecord[] = flatten(zip(...filteredStatementsGroup));
  const message: string = replies.realTalkConvo(convo);

  if (!hasValidContentLength(message, "ResponseBody")) {
    const messageSlice: string = replies.realTalkConvo(convo.slice(0, 2));

    if (!hasValidContentLength(messageSlice, "ResponseBody")) {
      const userIds: string[] = uniq(users.map(user => user.id));
      await interaction.editReply(replies.realTalkConvoTooLong(userIds, MaxContentLength.ResponseBody));

      return deleteReply(interaction);
    }

    await interaction.editReply(messageSlice);
    return;
  }

  await interaction.editReply(message);
};

const realTalkHistory = async (_client: Client, interaction: CommandInteraction): Promise<void> => {
  const statementsAcc: StatementRecord[] = [];
  const allStatements: StatementRecord[] = await db.getAllStatements([
    { column: "created_at", order: "asc" }
  ]);

  const statementsSlice: StatementRecord[] = takeRightWhile(allStatements, s => {
    statementsAcc.push(s);
    return hasValidContentLength(replies.realTalkHistory(statementsAcc), "ResponseBody");
  });

  await interaction.reply(replies.realTalkHistory(statementsSlice));
};

const realTalkStats = async (_client: Client, interaction: CommandInteraction): Promise<void> => {
  const stats: RealTalkStats = await db.getStatementStats();
  const totalStatements: number = sumBy(Object.values(stats), stat => stat.statements);
  const message: string = replies.realTalkStats(stats, totalStatements);

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
    replies.realTalkQuiz(interaction.user.id, statement.content, quizTimeout)
  );

  const collector: MessageCollector = interaction.channel.createMessageCollector({
    filter: ({ content }: Message): boolean =>
      content.toLocaleLowerCase().startsWith(`#${RealTalkCommand.RealTalk}`),
    time: quizTimeout,
  });

  const correctAnswerUserIds: string[] = [];

  collector.on("collect", message => {
    const mention: string = message.content.trim().split(" ")[1];
    const userId: string = getUserIdFromMention(mention);
    const isCorrectUserId: boolean = userId === statement.accusedUserId;

    if (isCorrectUserId) {
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

  let canvas: Canvas.Canvas;
  const imagePath: string = "image.jpeg";
  const quoteFontSize: number = 35;
  const padding: number = 20;
  const avatarHeight: number = 50;
  const avatarWidth: number = 50;

  const deleteImageFile = (): void => {
    try {
      fs.unlinkSync(imagePath);
    } catch (error) {
      logger.error(error);
    }
  };

  const deleteReply: (interaction: CommandInteraction) => Promise<void> =
    delayDeleteReply.bind(null, Time.Second * 5);

  const accusedUser: User = interaction.options.getUser("who");
  const shouldGetLatestQuote: boolean = interaction.options.getBoolean("quote");

  const getStatement: (where?: any) => Knex.QueryBuilder<StatementRecord | StatementRecord[]> =
    shouldGetLatestQuote ? db.getLatestStatement : db.getRandomStatement;
  const statementResult: StatementRecord | StatementRecord[]=
    await getStatement(accusedUser && { accusedUserId: accusedUser.id });

  const statement: StatementRecord = isArray(statementResult)
    ? statementResult[0]
    : statementResult;

  const topic: string = interaction.options.getString("topic") || "";
  const unsplashPayload: UnsplashRandomParams = { count: 1, query: topic };

  if (!statement) {
    await interaction.editReply(replies.realTalkNoStatements([ accusedUser.id ]));
    return deleteReply(interaction);
  }

  try {
    const res: UnsplashApiResponse<UnsplashRandomPhoto | UnsplashRandomPhoto[]> =
      await unsplash.photos.getRandom(unsplashPayload);

    if (res.status !== 200) {
      const message: string | InteractionReplyOptions = res.status === 404
        ? replies.noImagesFound(topic)
        : replies.internalError();

      await interaction.editReply(message);
      return deleteReply(interaction);
    }

    const unsplashPhoto: UnsplashRandomPhoto = isArray(res.response) ? res.response[0] : res.response;
    const image: Response = await fetch(unsplashPhoto.urls.small);
    fs.writeFileSync(imagePath, Buffer.from(await image.arrayBuffer()));

    canvas = Canvas.createCanvas(600, 600);
    const ctx: Canvas.SKRSContext2D = canvas.getContext("2d");
    const background: Canvas.Image = new Canvas.Image();
    background.src = fs.readFileSync(imagePath);
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffffff";
    ctx.font = `italic ${quoteFontSize} sans-serif`;
    const content: string = replaceMentions(statement.content, getDisplayName);

    wrapCanvasText(canvas, `"${content}"`, canvas.width - padding * 2).forEach((line, i) => {
      const dyOffset: number = i > 0 ? i * quoteFontSize + 5 : 0;
      ctx.fillText(line, padding, canvas.height / 2 + dyOffset, canvas.width - padding);
    });

    const displayName: string = "- " + getDisplayName(statement.accusedUserId);
    ctx.font = "25px sans-serif";
    ctx.fillText(displayName, padding, canvas.height - padding, canvas.width - padding);
    const member: GuildMember = getMember(statement.accusedUserId);

    if (member) {
      ctx.beginPath();
      ctx.arc(padding + avatarWidth / 2, padding + avatarHeight / 2, avatarWidth / 2, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();

      const avatarResponse: Response = await fetch(member.user.displayAvatarURL({ format: "jpg" }));
      const avatar: Canvas.Image = new Canvas.Image();
      avatar.src = Buffer.from(await avatarResponse.arrayBuffer());

      ctx.drawImage(avatar, padding, padding, avatarWidth, avatarHeight);
    }
  } catch (error) {
    logger.error(error);
    deleteImageFile();

    await interaction.editReply(replies.internalError());
    return deleteReply(interaction);
  }

  const attachment: MessageAttachment = new MessageAttachment(canvas.toBuffer("image/png"), imagePath);
  await interaction.editReply({ files: [ attachment] });

  deleteImageFile();
};

export default {
  [RealTalkCommand.RealTalk]: async (client: Client, interaction: CommandInteraction, ...args: any[]): Promise<void> => {
    const subcommand: string = interaction.options.getSubcommand();

    switch(subcommand) {
      case RealTalkSubcommand.Record:
        return useThrottle(realTalkRecord, THROTTLE_DURATION)(client, interaction, ...args);
      case RealTalkSubcommand.Convo:
        return realTalkConvo(client, interaction);
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
