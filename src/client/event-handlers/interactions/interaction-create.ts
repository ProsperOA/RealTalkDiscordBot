import * as fs from "fs";
import fetch from "cross-fetch";
import { ApiResponse as UnsplashApiResponse } from "unsplash-js/dist/helpers/response";
import { Canvas, createCanvas, Image, SKRSContext2D } from "@napi-rs/canvas";
import { Random as UnsplashRandomPhoto } from "unsplash-js/dist/methods/photos/types";
import { RandomParams as UnsplashRandomParams } from "unsplash-js/dist/methods/photos";
import { chunk, dropRight, flatten, isArray, isEmpty, uniq, zip } from "lodash";
import { randomUUID } from "crypto";

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
import { openAI, unsplash } from "../../../index";

import {
  applyMiddleware,
  Middleware,
  RateLimitOptions,
  useRateLimit,
  useThrottle,
} from "../../middleware";

import {
  RealTalkStats,
  CompactRealTalkStats,
  Statement,
  StatementWitness,
  UpdootedStatement,
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
  delayDeleteMessage,
  chunkString,
} from "../../../utils";

export interface InteractionCreateInput {
  client: Client;
  interaction: CommandInteraction;
  middleware?: Middleware;
}

export type InteractionCreateHandler =
  (input: InteractionCreateInput, ...args: any[]) => Promise<void>;

enum MaxContentLength {
  InteractionOption = 2000,
  ResponseBody = 2000,
}

export enum ThrottleConfig {
  realTalkChat = Time.Minute * 5,
  realTalkGenerateImage = Time.Minute * 10,
  realTalkRecord = Time.Second * 15,
  realTalkImage = Time.Minute,
  realTalkQuiz = Time.Minute,
}

export const RateLimitConfig: Readonly<Record<string, RateLimitOptions>> = {
  realTalkChat: { limit: 10, timeFrame: Time.Hour },
  realTalkGenerateImage: { limit: 3, timeFrame: Time.Hour },
};

const realTalkQuizCache: Cache = cache.new("realTalkQuizCache");
const realTalkHistoryCache: Cache = cache.new("realTalkHistory");

const getThrottleConfig = (key: keyof typeof ThrottleConfig): number =>
  Config.IsDev ? 0 : ThrottleConfig[key];

const getRateLimitConfig = (key: string): RateLimitOptions =>
  Config.IsDev ? { limit: Infinity, timeFrame: Infinity } : RateLimitConfig[key];

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

const realTalkRecord = async (input: InteractionCreateInput, requireWitnesses: boolean = true): Promise<void> => {
  const { client, interaction, middleware }: InteractionCreateInput = input;
  const targetUser: User = interaction.options.getUser("who");

  if (targetUser.id === client.user.id) {
    middleware.throttle.remove(interaction);
    return interaction.reply(replies.noRealTalkingMe());
  }

  const statement: string = cleanStatement(interaction.options.getString("what"));
  const existingStatement: Statement = await db.getStatementWhere({
    accusedUserId: targetUser.id,
    content: statement,
  });

  if (existingStatement) {
    middleware.throttle.remove(interaction);

    return interaction.reply(
      replies.realTalkExists(interaction.user.id, existingStatement.url)
    );
  }

  let witnesses: Partial<StatementWitness>[];
  const { voice }: GuildMember = interaction.member as GuildMember;

  if (!Config.IsDev && requireWitnesses) {
    if (!voice.channelId) {
      middleware.throttle.remove(interaction);
      return interaction.reply(replies.realTalkNotInVoiceChat());
    }

    witnesses = (await getRealTalkWitnesses(client, voice.channelId))
      .filter(user => user.id !== interaction.user.id)
      .map(user => ({ userId: user.id }));

    if (isEmpty(witnesses)) {
      middleware.throttle.remove(interaction);
      return interaction.reply(replies.realTalkNoWitnesses());
    }
  }

  if (!hasValidContentLength(statement, "InteractionOption")) {
    middleware.throttle.remove(interaction);
    return interaction.reply(replies.invalidContentLength(MaxContentLength.InteractionOption));
  }

  const incriminatingEvidence: string = replies.realTalkRecord(targetUser.id, statement);
  const message: Message = await interaction.reply({ content: incriminatingEvidence, fetchReply: true }) as Message;

  const statementRecord: Partial<Statement> = {
    accusedUserId: targetUser.id,
    content: statement,
    createdAt: interaction.createdAt,
    url: message.url,
    userId: interaction.user.id,
  };

  await db.createStatement(statementRecord, witnesses);
};

const realTalkChat = async (input: InteractionCreateInput): Promise<void> => {
  const { interaction, middleware }: InteractionCreateInput = input;

  await interaction.deferReply();
  const message: string = interaction.options.getString("message", true);

  if (!hasValidContentLength(message, "InteractionOption")) {
    await interaction.editReply(
      replies.invalidContentLength(MaxContentLength.InteractionOption)
    );

    delayDeleteReply(Time.Second * 5, interaction);

    middleware.throttle.remove(interaction);
    middleware.rateLimit.decrement(interaction);

    return;
  }

  let res = null;

  try {
    res = await openAI.createCompletion({
      model: "text-davinci-003",
      prompt: message,
      max_tokens: 1000,
    });
  } catch (error) {
    await interaction.editReply(replies.internalError());
    delayDeleteReply(Time.Second * 5, interaction);

    middleware.throttle.remove(interaction);
    middleware.rateLimit.decrement(interaction);

    logger.error(error);
    return;
  }

  const response = res.data.choices[0].text;

  if (!hasValidContentLength(response, "ResponseBody")) {
    await interaction.deleteReply();
    const maxChunkSize: number =
      MaxContentLength.ResponseBody - replies.realTalkChat("", "").length - 100;

    const chunks: string[] = chunkString(response, maxChunkSize);
    const totalChunks: number = chunks.length;

    const firstChunk: string = `${chunks.shift()}\n_(1/${totalChunks})_\n\n`;
    await interaction.channel.send(replies.realTalkChat(message, firstChunk));

    for (const [i, piece] of chunks.entries()) {
      let msg: string = `${piece}\n_(${2 + i}/${totalChunks})_\n`;

      if (i !== chunks.length - 1) {
        msg += "\n";
      }

      await interaction.channel.send(msg);
    }

    return;
  }

  await interaction.editReply(replies.realTalkChat(message, response));
};

const realTalkGenerateImage = async (input: InteractionCreateInput): Promise<void> => {
  const { interaction, middleware }: InteractionCreateInput = input;

  await interaction.deferReply();
  const description: string = interaction.options.getString("description", true);
  let res = null;

  try {
    res = await openAI.createImage({
      prompt: description,
      size: "1024x1024",
    });
  } catch (error) {
    await interaction.editReply(replies.internalError());
    delayDeleteReply(Time.Second * 5, interaction);

    middleware.throttle.remove(interaction);
    middleware.rateLimit.decrement(interaction);

    logger.error(error);
    return;
  }

  const { url } = res.data.data[0];
  const image: Response = await fetch(url);
  const imagePath: string = `./image-${randomUUID()}.png`;

  fs.writeFileSync(imagePath, Buffer.from(await image.arrayBuffer()));
  await interaction.editReply(replies.realTalkGenerateImage(description, imagePath));

  try {
    fs.unlinkSync(imagePath);
  } catch (error) {
    logger.error(error);
  }
};

const realTalkConvo = async (input: InteractionCreateInput): Promise<void> => {
  const { interaction }: InteractionCreateInput = input;
  await interaction.deferReply();
  const maxStatementsToFetch: number = 3;

  const deleteReply: (interaction: CommandInteraction) => Promise<void> =
    delayDeleteReply.bind(null, Time.Second * 5);

  const user1: User = interaction.options.getUser("user1", true);
  const user2: User = interaction.options.getUser("user2");
  const hasSecondUser: boolean = Boolean(user2);

  const getUserStatements = async (userId: string): Promise<Statement[]> =>
    await db.getRandomStatements({ accusedUserId: userId }, maxStatementsToFetch);

  const user1Statements: Statement[] = await getUserStatements(user1.id);
  const user2Statements: Statement[] = hasSecondUser
    ? await getUserStatements(user2.id)
    : null;

  const statementsGroup: [Statement[], Statement[]] = [
    user1Statements,
    user2Statements || await getUserStatements(user1.id),
  ];

  const noStatementsUserIds: string[] = [];

  if (!user1Statements.length) {
    noStatementsUserIds.push(user1.id);
  }

  if (hasSecondUser && !user2Statements.length) {
    noStatementsUserIds.push(user2.id);
  }

  if (noStatementsUserIds.length) {
    await interaction.editReply(replies.realTalkNoStatements(uniq(noStatementsUserIds)));
    deleteReply(interaction);

    return;
  }

  const maxStatementsPerUser: number = hasSecondUser
    ? Math.min(user1Statements.length, user2Statements.length)
    : maxStatementsToFetch;

  const dropExcessStatements = (statements: Statement[]): Statement[] =>
    dropRight(statements, statements.length - maxStatementsPerUser);

  const filteredStatementsGroup: [Statement[], Statement[]] = hasSecondUser
    ? statementsGroup.map(dropExcessStatements) as typeof statementsGroup
    : statementsGroup;

  const convo: Statement[] = flatten(zip(...filteredStatementsGroup));
  const message: string = replies.realTalkConvo(convo);
  const hasValidMessageLength: boolean = hasValidContentLength(message, "ResponseBody");

  const messageSlice: string = hasValidMessageLength
    ? ""
    : replies.realTalkConvo(convo.slice(0, 2));

  if (!(hasValidMessageLength || hasValidContentLength(messageSlice, "ResponseBody"))) {
    const userIds: string[] = [ user1.id ];

    if (hasSecondUser && user2.id !== user1.id) {
      userIds.push(user2.id);
    }

    await interaction.editReply(replies.realTalkConvoTooLong(userIds, MaxContentLength.ResponseBody));
    deleteReply(interaction);

    return;
  }

  await interaction.editReply(messageSlice || message);
};

const realTalkHistory = async (input: InteractionCreateInput): Promise<void> => {
  const { interaction }: InteractionCreateInput = input;
  await interaction.deferReply();

  const messageTimeout: number = Time.Minute * 10;
  const targetUser: User = interaction.options.getUser("user");
  const userId: string = targetUser?.id ?? "all";

  const statements: Statement[] = await db.getAllStatements(
    targetUser && { accusedUserId: targetUser.id }
  );

  if (!statements) {
    await interaction.editReply(replies.realTalkNoStatements([ userId ]));
    return;
  }

  if (realTalkHistoryCache.ttl(userId)) {
    const url: string = realTalkHistoryCache.get(userId);
    await interaction.editReply(replies.realTalkHistoryLink(url, userId));

    return;
  }

  let messageUrl: string = null;

  try {
    const replyMessage: Message = await interaction.editReply(
      replies.realTalkHistory(targetUser?.id, statements)
    ) as Message;

    messageUrl = replyMessage.url;

    delayDeleteMessage(messageTimeout, replyMessage);
  } catch (error) {
    if (error.issues[0].code === "too_big") {
      await interaction.deleteReply();
      const statementsGroup: Statement[][] = chunk(statements, 6);

      for (let i = 0; i < statementsGroup.length; i++) {
        const channelMessage: Message = await interaction.channel.send(
          replies.realTalkHistory(targetUser?.id, statementsGroup[i], i + 1, statementsGroup.length)
        );

        if (i === 0) {
          messageUrl = channelMessage.url;
        }

        delayDeleteMessage(messageTimeout, channelMessage);
      }
    }
  }

  realTalkHistoryCache.set(userId, messageUrl, messageTimeout);
};

const realTalkStats = async (input: InteractionCreateInput): Promise<void> => {
  const { interaction }: InteractionCreateInput = input;
  const stats: RealTalkStats = await db.getStatementStats();
  const totalStatements: number = await db.getTotalStatements();
  const message: string = replies.realTalkStats(stats, totalStatements);

  if (!hasValidContentLength(message, "ResponseBody")) {
    const compactStats: CompactRealTalkStats = {
      uniqueUsers: 0,
      uses: totalStatements,
    };

    Object.values(stats).forEach(({ uses }) => {
      if (uses) {
        compactStats.uniqueUsers += 1;
      }
    });

    return interaction.reply(replies.realTalkStatsCompact(compactStats));
  }

  await interaction.reply(message);
};

const realTalkQuiz = async (input: InteractionCreateInput): Promise<void> => {
  const { interaction, middleware }: InteractionCreateInput = input;
  const previousTimeout: number = realTalkQuizCache.ttl("previousStatement");

  if (previousTimeout) {
    middleware.throttle.remove(interaction);
    return interaction.reply(replies.realTalkQuizActive(previousTimeout));
  }

  let statement: Statement = null;

  do {
    statement = (await db.getRandomStatements())[0];
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

const realTalkImage = async (input: InteractionCreateInput): Promise<void> => {
  const { interaction, middleware }: InteractionCreateInput = input;
  await interaction.deferReply();

  let canvas: Canvas;
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
  const shouldGetLatestStatement: boolean = interaction.options.getBoolean("latest");
  const dbQuery: any = accusedUser && { accusedUserId: accusedUser.id };

  const statement: Statement = shouldGetLatestStatement
    ? await db.getLatestStatement(dbQuery)
    : (await db.getRandomStatements(dbQuery))[0];

  const topic: string = interaction.options.getString("topic") || "";
  const unsplashPayload: UnsplashRandomParams = { count: 1, query: topic };

  if (!statement) {
    await interaction.editReply(replies.realTalkNoStatements([ accusedUser.id ]));
    deleteReply(interaction);
    middleware.throttle.remove(interaction);

    return;
  }

  try {
    const res: UnsplashApiResponse<UnsplashRandomPhoto | UnsplashRandomPhoto[]> =
      await unsplash.photos.getRandom(unsplashPayload);

    if (res.status !== 200) {
      const message: string | InteractionReplyOptions = res.status === 404
        ? replies.noImagesFound(topic)
        : replies.internalError();

      await interaction.editReply(message);
      deleteReply(interaction);
      middleware.throttle.remove(interaction);

      return;
    }

    const unsplashPhoto: UnsplashRandomPhoto = isArray(res.response) ? res.response[0] : res.response;
    const image: Response = await fetch(unsplashPhoto.urls.small);
    fs.writeFileSync(imagePath, Buffer.from(await image.arrayBuffer()));

    canvas = createCanvas(600, 600);
    const ctx: SKRSContext2D = canvas.getContext("2d");
    const background: Image = new Image();
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
      const avatar: Image = new Image();
      avatar.src = Buffer.from(await avatarResponse.arrayBuffer());

      ctx.drawImage(avatar, padding, padding, avatarWidth, avatarHeight);
    }
  } catch (error) {
    await interaction.editReply(replies.internalError());
    deleteReply(interaction);

    logger.error(error);
    deleteImageFile();
    middleware.throttle.remove(interaction);


    return;
  }

  const attachment: MessageAttachment = new MessageAttachment(canvas.toBuffer("image/png"), imagePath);
  await interaction.editReply({ files: [ attachment ] });

  deleteImageFile();
};

const realTalkUpdoots = async (input: InteractionCreateInput): Promise<void> => {
  const { interaction }: InteractionCreateInput = input;
  const targetUser: User = interaction.options.getUser("who", true);
  const statements: UpdootedStatement[] = await db.getMostUpdootedStatements({
    accusedUserId: targetUser.id,
  });

  if (!statements.length) {
    return interaction.reply(replies.realTalkUpdootsNotFound(targetUser.id));
  }

  await interaction.reply(replies.realTalkUpdoots(targetUser.id, statements));
};

const interactionHandlers: { [name: string]: InteractionCreateHandler } = {
  [RealTalkSubcommand.Record]: applyMiddleware(
    [useThrottle(getThrottleConfig)],
    realTalkRecord
  ),
  [RealTalkSubcommand.Chat]: applyMiddleware(
    [useThrottle(getThrottleConfig), useRateLimit(getRateLimitConfig)],
    realTalkChat
  ),
  [RealTalkSubcommand.Convo]: realTalkConvo,
  [RealTalkSubcommand.GenerateImage]: applyMiddleware(
    [useThrottle(getThrottleConfig), useRateLimit(getRateLimitConfig)],
    realTalkGenerateImage
  ),
  [RealTalkSubcommand.History]: realTalkHistory,
  [RealTalkSubcommand.Stats]: realTalkStats,
  [RealTalkSubcommand.Quiz]: applyMiddleware(
    [useThrottle(getThrottleConfig)],
    realTalkQuiz
  ),
  [RealTalkSubcommand.Image]: applyMiddleware(
    [useThrottle(getThrottleConfig)],
    realTalkImage
  ),
  [RealTalkSubcommand.Updoots]: realTalkUpdoots,
};

export default {
  [RealTalkCommand.RealTalk]: async (input: InteractionCreateInput, ...args: any[]): Promise<void> => {
    const { client, interaction }: InteractionCreateInput = input;
    const subcommand: string = interaction.options.getSubcommand();
    const handlerFn: InteractionCreateHandler = interactionHandlers[subcommand];

    if (!handlerFn) {
      logger.error(`${subcommand} is an invalid ${RealTalkCommand.RealTalk} subcommand`);
      return interaction.reply(replies.internalError());
    }

    return handlerFn({ client, interaction }, ...args);
  }
};
