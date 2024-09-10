import { isEmpty, trim } from "lodash";
import { stripIndents } from "common-tags";

import {
  CommandInteraction,
  CommandInteractionOption,
  InteractionReplyOptions,
  MessageActionRow,
  MessageButton,
} from "discord.js";

import {
  channelMention,
  Embed,
  hideLinkEmbed,
  time,
} from "@discordjs/builders";

import {
  RealTalkStats,
  CompactRealTalkStats,
  Statement,
  UpdootedStatement,
} from "../db/models";

import {
  Config,
  getDisplayName,
  getRole,
  msConvert,
  nicknameMention,
  pluralize,
} from "../utils";
import { MessageButtonStyles } from "discord.js/typings/enums";

const DEV_MODE_LABEL: string = "`[DEVELOPMENT MODE]`";

export const withDevLabel = (message: string): string =>
  Config.IsDev
    ? DEV_MODE_LABEL + "\n" + message
    : message;

export const extractStatementContent = (formattedStatement: string): string =>
  formattedStatement
    ?.match(/_"(.)*"_/)
    ?.[0]
    .replace("_\"", "")
    .replace("\"_", "")
    ?? "";

const quietReply = (content: string): InteractionReplyOptions =>
  ({ content: withDevLabel(content), ephemeral: true });

const formatStatementUrl = (statement: Statement): string =>
  statement.deletedAt
    ? "deleted on " + time(statement.deletedAt)
    : hideLinkEmbed(statement.url);

const formatInteractionOption = (option: CommandInteractionOption): string => {
  let parsedValue: string = String(option.value);

  switch (option.type) {
    case "USER":
      parsedValue = `@${getDisplayName(parsedValue)}`;
      break;
    case "ROLE":
      parsedValue = `#${getRole(parsedValue).name}`;
      break;
    case "CHANNEL":
      parsedValue = channelMention(parsedValue);
      break;
    default:
      break;
  }

  return parsedValue;
};

const formatInteractionInput = (interaction: CommandInteraction): string =>
  interaction.options.data[0].options
    .map((option) => `**${option.name}**: \`${formatInteractionOption(option)}\`\n`)
    .join("");

export default {

  donationLink: (): string =>
    withDevLabel("**#RealTalk** you should donate pls. \:pray:\n" + Config.DonationURL),

  internalError: (interaction: CommandInteraction): InteractionReplyOptions =>
    quietReply(stripIndents`
      **#RealTalk**, an error occurred. \:grimacing:

      Here's what you sent:
      ${formatInteractionInput(interaction)}
    `),

  invalidContentLength: (length: number): InteractionReplyOptions =>
    quietReply(`**#RealTalk**, input must be ${length} characters or less`),

  noImagesFound: (topic: string): InteractionReplyOptions =>
    quietReply(`**#RealTalk**, no images found for "${topic}".`),

  noRealTalkingMe: (): InteractionReplyOptions =>
    quietReply("**#RealTalk**, you can't real talk the RealTalkBot!"),

  realTalkChat: (message: string, response: string): string =>
    withDevLabel(stripIndents`**Message**: ${message}

      **Response:** ${trim(response)}`
    ),

  realTalkConvo: (statements: Statement[]): string =>
    withDevLabel(statements.map(({ accusedUserId, content }, i) =>
      `${i % 2 > 0 ? "> " : ""}**${getDisplayName(accusedUserId)}**: _${content}_`
    ).join("\n")),

    realTalkConvoTooLong: (userIds: string[], length: number): string =>
      withDevLabel(stripIndents`**RealTalk** the convo between ${userIds.map(getDisplayName).join(", ")} is too long!
        (must be less than ${length} characters)`),

  realTalkExists: (userId: string, url: string): string =>
    withDevLabel(`Yo, ${nicknameMention(userId)}, it's been **#RealTalk'd**: ${hideLinkEmbed(url)}`),

  realTalkGenerateImage: (description: string, path: string): InteractionReplyOptions =>
    ({ content: withDevLabel(`**Description:** ${description}\n\n`), files: [ path ] }),

  realTalkHistory: (userId: string, statements: Statement[], part: number = 1, total: number = 1): InteractionReplyOptions => ({
    embeds: [
      new Embed()
        .setColor(0x0099FF)
        .setTitle(withDevLabel(`**#RealTalk History** (${part}/${total})`))
        .setDescription(userId ? `\`Statements from ${getDisplayName(userId)}\`` : "--")
        .addFields(
          ...statements.map(statement => ({
            name: `${userId ? "" : getDisplayName(statement.accusedUserId) + ": "} _"${statement.content}"_`,
            value: formatStatementUrl(statement),
          }))
        )
    ],
  }),

  realTalkHistoryLink: (url: string, userId: string): string =>
    `**#RealTalk History** for ${userId === "all" ? "all users" : getDisplayName(userId)}: ${url}`,

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

  realTalkReminderSet: (targetDate: Date): InteractionReplyOptions => {
    const deleteButton = new MessageButton()
      .setCustomId("delete")
      .setLabel("Delete")
      .setStyle(MessageButtonStyles.DANGER);

    const actionRow = new MessageActionRow()
      .addComponents(deleteButton);

    return {
      content: `**#RealTalk Reminder Set** for ${time(targetDate, "F")} (${time(targetDate, "R")})\n`,
      components: [ actionRow ],
    };
  },

  realTalkReminderLimit: (): string =>
    `**#RealTalk** you've reached the reminder limit. \:grimacing:`,

  realTalkReminderPastDate: (): string =>
    `**#RealTalk** you can't set reminders in the past. \:facepalm:`,

  realTalkUpdootsNotFound: (userId: string): InteractionReplyOptions =>
    quietReply(`**#RealTalk** ${getDisplayName(userId)} has no updooted statements`),

  throttleCoolDown: (interaction: CommandInteraction, duration: number): InteractionReplyOptions =>
    quietReply(stripIndents`
      **#RealTalk** chill on /${interaction.options.getSubcommand()}. Try again at ${time(new Date(Date.now() + duration), "t")}
      Here's what you sent:

      ${formatInteractionInput(interaction)}
    `),

  rateLimitHit: (interaction: CommandInteraction, duration: number): InteractionReplyOptions =>
    quietReply(stripIndents`
      **#RealTalk** usage limit reached on /${interaction.options.getSubcommand()}. Try again at ${time(new Date(Date.now() + duration), "t")}
      Here's what you sent:

      ${formatInteractionInput(interaction)}
    `),

};
