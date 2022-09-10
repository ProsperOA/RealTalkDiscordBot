import { InteractionReplyOptions } from "discord.js";
import { hideLinkEmbed, time } from "@discordjs/builders";
import { isEmpty } from "lodash";
import { stripIndents } from "common-tags";

import { RealTalkStats, CompactRealTalkStats, Statement, UpdootedStatement } from "../db/models";
import { Config, getDisplayName, msConvert, nicknameMention, pluralize } from "../utils";

const DEV_MODE_LABEL: string = "`[DEVELOPMENT MODE]`";

export const withDevLabel = (message: string): string =>
  Config.IsDev
    ? DEV_MODE_LABEL + "\n" + message
    : message;

export const extractStatementContent = (formattedStatement: string): string => {
  if (!formattedStatement) {
    return formattedStatement;
  }

  const result: RegExpMatchArray = formattedStatement.match(/_"(.)*"_/);

  return result?.[0].replace("_\"", "").replace("\"_", "") ?? "";
};

const quietReply = (content: string): InteractionReplyOptions =>
  ({ content: withDevLabel(content), ephemeral: true });

const formatStatementUrl = (statement: Statement): string =>
  statement.deletedAt
    ? "deleted on " + time(statement.deletedAt)
    : hideLinkEmbed(statement.url);

export default {

  donationLink: (): string =>
    withDevLabel("**#RealTalk** you should donate pls. \:pray:\n" + Config.DonationURL),

  internalError: (): InteractionReplyOptions =>
    quietReply("**#RealTalk**, an error occurred. \:grimacing:"),

  invalidStatementLength: (length: number): InteractionReplyOptions =>
    quietReply(`**#RealTalk**, the statement must be ${length} characters or less`),

  noImagesFound: (topic: string): InteractionReplyOptions =>
    quietReply(`**#RealTalk**, no images found for topic "${topic}".`),

  noRealTalkingMe: (): InteractionReplyOptions =>
    quietReply("**#RealTalk**, you can't real talk the RealTalkBot!"),

  realTalkConvo: (statements: Statement[]): string =>
    withDevLabel(statements.map(({ accusedUserId, content }, i) =>
      `${i % 2 > 0 ? "> " : ""}**${getDisplayName(accusedUserId)}**: _${content}_`
    ).join("\n")),

    realTalkConvoTooLong: (userIds: string[], length: number): string =>
      withDevLabel(stripIndents`**RealTalk** the convo between ${userIds.map(getDisplayName).join(", ")} is too long!
        (must be less than ${length} characters)`),

  realTalkExists: (userId: string, url: string): string =>
    withDevLabel(`Yo, ${nicknameMention(userId)}, it's been **#RealTalk'd**: ${hideLinkEmbed(url)}`),

  realTalkHistory: (statements: Statement[]): string =>
    withDevLabel(statements.map(statement => stripIndents`
      > **#RealTalk** ${getDisplayName(statement.accusedUserId)} said: _"${statement.content}"_.
      > (provided by ${getDisplayName(statement.userId)}) ${formatStatementUrl(statement)}`
    ).join("\n\n")),

  realTalkNoStatements: (userIds: string[]): InteractionReplyOptions =>
    quietReply(`The following user(s) have no #RealTalk statements: ${userIds.map(getDisplayName).join(", ")}`),

  realTalkIsCap: ({ content, url, userId }: Statement): string =>
    withDevLabel(stripIndents`**#RealTalk**, the following statement made by ${nicknameMention(userId)} is cap:
      _"${content}"_
      ${hideLinkEmbed(url)}`),

  realTalkNotInVoiceChat: (): InteractionReplyOptions =>
    quietReply("**#RealTalk**, you have to be in a voice chat to record a statement."),

  realTalkNoWitnesses: (): InteractionReplyOptions =>
    quietReply("**#RealTalk**, you need witnesses (online, in chat, and not deafened) to make a statement."),

  realTalkRecord: (userId: string, statement: string): string =>
    withDevLabel(stripIndents`**The following is provided under the terms of #RealTalk**
      Date: ${time(new Date())}
      ${nicknameMention(userId)}: _"${statement}"_`),

  realTalkEmojiReaction: (userId: string, message: string): string => {
    const label: string = `**${nicknameMention(userId)} used the #RealTalk emoji**`;

    return message.indexOf(DEV_MODE_LABEL) > -1
      ? DEV_MODE_LABEL + "\n" + message.replace(DEV_MODE_LABEL, label)
      : label + "\n" + message;
  },

  realTalkStats: (stats: RealTalkStats, totalStatements: number): string =>
    withDevLabel(stripIndents`**#RealTalk Stats**: ${totalStatements} Total Statements
      ${Object.keys(stats).map((userId, i) => {
        const { uses, statements }: RealTalkStats["userId"] = stats[userId];

        let message: string = `> #${i + 1}. ${getDisplayName(userId)}: `;
        const usesPart: string = `${uses} ${pluralize("use", uses)}`;
        const percentagePart: string = `(${(statements / totalStatements * 100).toFixed(2)}%)`;
        const statementsPart: string = `${statements} ${pluralize("statement", statements)} ${percentagePart}`;

        if (uses && statements) {
          message += `${usesPart}, ${statementsPart}`;
        } else if (uses) {
          message += usesPart;
        } else {
          message += statementsPart;
        }

        if (i === 0) {
          message += " \:crown:";
        }

        console.log(message);
        return message;
      }).join("\n")}`),

  realTalkStatsCompact: ({ uniqueUsers, uses }: CompactRealTalkStats): string =>
    withDevLabel(
      `**#RealTalk** has been used ${uses} ${pluralize("time", uses)} by ${uniqueUsers} unique ${pluralize("user", uniqueUsers)}`
    ),

  realTalkQuiz: (userId: string, statement: string, duration: number): string =>
    withDevLabel(stripIndents`
      Who's the type of person to say: _"${statement}"_?
      You have ${msConvert(duration, "Second")}s to respond in chat with: **#RealTalk @Username**
      _e.g. #RealTalk ${nicknameMention(userId)}_`),

  realTalkQuizActive: (duration: number): InteractionReplyOptions =>
    quietReply(`**#RealTalk** wait for the current quiz to end (${msConvert(duration, "Second")}s left).`),

  realTalkQuizEnd: (accusedUserId: string, userIds: string[]): string =>
    withDevLabel(stripIndents`
      ${isEmpty(userIds) ? "No one" : userIds.map(nicknameMention).join(", ")} got it right.
      ${nicknameMention(accusedUserId)} is the type of person that would say that tho...`),

  realTalkUpdoots: (userId: string, statements: UpdootedStatement[]): string =>
    withDevLabel(stripIndents`**#RealTalk Most Updooted Statements from ${nicknameMention(userId)}**
      ${statements.map(({ content, updoots }, i) =>
        `#${i + 1}. _"${content}"_ (${updoots} ${pluralize("updoot", updoots)})`
    ).join("\n")}`),

  realTalkUpdootsNotFound: (userId: string): InteractionReplyOptions =>
    quietReply(`**#RealTalk** ${getDisplayName(userId)} has no updooted statements`),

  throttleCoolDown: (duration: number, subcommand: string): InteractionReplyOptions =>
    quietReply(`**#RealTalk**, chill... ${msConvert(duration, "Second")}s left on /${subcommand}`),

};
