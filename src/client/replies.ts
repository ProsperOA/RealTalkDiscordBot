import { InteractionReplyOptions } from "discord.js";
import { hideLinkEmbed, time } from "@discordjs/builders";
import { isEmpty, isObject } from "lodash";
import { stripIndents } from "common-tags";

import { RealTalkStats, RealTalkStatsCompact, StatementRecord } from "../db/models";
import { Config, getUsername, msConvert, nicknameMention, pluralize } from "../utils";

export const withDevLabel = (message: string | InteractionReplyOptions): string | InteractionReplyOptions => {
  if (!Config.IsDev) {
    return message;
  }

  const content: string = (
    stripIndents`**[DEVELOPMENT MODE]**

    ${isObject(message) ? message.content : message}`
  );

  return typeof message === "string"
    ? content
    : { ...message, content };
};

export const extractStatementContent = (formattedStatement: string): string => {
  if (!formattedStatement) {
    return formattedStatement;
  }

  const result: RegExpMatchArray = formattedStatement.match(/_"(.)*"_/);

  return result
    ? result[0].replace("_\"", "").replace("\"_", "")
    : "";
};

const quietReply = (content: string): InteractionReplyOptions => withDevLabel({
  content,
  ephemeral: true
}) as InteractionReplyOptions;

const formatStatementUrl = (statement: StatementRecord): string =>
  statement.deletedAt
    ? `deleted on ${time(statement.deletedAt)}`
    : hideLinkEmbed(statement.url);

export default {

  internalError: (): InteractionReplyOptions => withDevLabel(
    quietReply("**#RealTalk**, an error occurred. \:grimacing:")) as InteractionReplyOptions,

  invalidStatementLength: (length: number): InteractionReplyOptions =>
    quietReply(`**#RealTalk**, the statement must be ${length} characters or less`),

  noImagesFound: (topic: string): InteractionReplyOptions =>
    quietReply(`**#RealTalk**, no images found for topic "${topic}".`),

  noRealTalkingMe: (): InteractionReplyOptions =>
    quietReply("**#RealTalk**, you can't real talk the RealTalkBot!"),

  realTalkExists: (userId: string, url: string): string =>
    withDevLabel(
      `Yo, ${nicknameMention(userId)}, it's been **#RealTalk'd**: ${hideLinkEmbed(url)}`
    ) as string,

  realTalkHistory: (statements: StatementRecord[]): string =>
    withDevLabel(statements.map(statement => stripIndents`
      > **#RealTalk** ${getUsername(statement.accusedUserId)} said: _"${statement.content}"_.
      > (provided by ${getUsername(statement.userId)}) ${formatStatementUrl(statement)}`
    ).join("\n\n")) as string,

  realTalkImage: (userId: string, accusedUserId: string): string =>
    withDevLabel(`**#RealTalk** recorded by ${nicknameMention(userId)}`) as string,

  realTalkIsCap: ({ content, url, userId }: StatementRecord): string =>
    withDevLabel(stripIndents`**#RealTalk**, the following statement made by ${nicknameMention(userId)} is cap:
      _"${content}"_
      ${hideLinkEmbed(url)}`) as string,

  realTalkNoWitnesses: (): InteractionReplyOptions =>
    quietReply("**#RealTalk**, you need witnesses (online, in chat, and not deafened) to make a statement."),

  realTalkRecord: (userId: string, statement: string): string =>
    withDevLabel(stripIndents`**The following is provided under the terms of #RealTalk**
      Date: ${time(new Date())}
      ${nicknameMention(userId)}: _"${statement}"_`) as string,

  realTalkEmojiReaction: (userId: string, message: string): string =>
    stripIndents`__${nicknameMention(userId)} used the #RealTalk emoji__

      ${message}`,

  realTalkStats: (stats: RealTalkStats): string =>
    withDevLabel(stripIndents`**#RealTalk Stats**
      ${Object.keys(stats).map(userId => {
        const { uses, statements }: RealTalkStats["userId"] = stats[userId];

        let message: string = `> ${getUsername(userId)}: `;
        const usesPart: string = `${uses} ${pluralize("use", uses)}`;
        const statementsPart: string = `${statements} ${pluralize("statement", statements)}`;

        if (uses && statements) {
          message += `${usesPart}, ${statementsPart}`;
        } else if (uses) {
          message += usesPart;
        } else {
          message += statementsPart;
        }

        return message;
      }).join("\n")}`) as string,

  realTalkStatsCompact: ({ uniqueUsers, uses }: RealTalkStatsCompact): string =>
    withDevLabel(
      `**#RealTalk** has been used ${uses} ${pluralize("time", uses)} by ${uniqueUsers} ${pluralize("user", uniqueUsers)}`
    ) as string,

  realTalkQuiz: (userId: string, statement: string, duration: number): string =>
    withDevLabel(stripIndents`
      Who's the type of person to say: _"${statement}"_?
      You have ${msConvert(duration, "Second")}s to respond in chat with: **#RealTalk @Username**
      _e.g. #RealTalk ${nicknameMention(userId)}_`) as string,

  realTalkQuizActive: (duration: number): InteractionReplyOptions =>
    quietReply(`**#RealTalk** wait for the current quiz to end (${msConvert(duration, "Second")}s left).`),

  realTalkQuizEnd: (accusedUserId: string, userIds: string[]): string =>
    withDevLabel(stripIndents`
      ${isEmpty(userIds) ? "No one" : userIds.map(nicknameMention).join(", ")} got it right.
      ${nicknameMention(accusedUserId)} is the type of person that would say that tho...`) as string,

  throttleCoolDown: (duration: number): InteractionReplyOptions =>
    quietReply(`**#RealTalk**, chill... ${msConvert(duration, "Second")}s left`),

};
