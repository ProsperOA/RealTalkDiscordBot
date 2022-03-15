import { InteractionReplyOptions } from 'discord.js';
import { hideLinkEmbed, time } from '@discordjs/builders';
import { isEmpty } from 'lodash';
import { stripIndents } from 'common-tags';

import { RealTalkStats, RealTalkStatsCompact, StatementRecord } from '../db/models/statements';
import { msConvert, nicknameMention, pluralizeIf } from '../utils';

/**
 * Returns a discreet reply message.
 *
 * @param {string} content - reply message content.
 * @returns {InteractionReplyOptions}
 */
const quietReply = (content: string): InteractionReplyOptions => ({
  content,
  ephemeral: true
});

export default {

  internalError: (): InteractionReplyOptions =>
    quietReply('**#RealTalk**, an error occurred. \:grimacing:'),

  invalidStatementLength: (length: number): InteractionReplyOptions =>
    quietReply(`**#RealTalk**, the statement must be ${length} characters or less`),

  realTalkExists: (userId: string, url: string): string =>
    `Yo, ${nicknameMention(userId)}, it's been **#RealTalk'd**: ${hideLinkEmbed(url)}`,

  realTalkHistory: (statements: StatementRecord[]): string =>
    statements.map(s => stripIndents`
      > **#RealTalk** ${nicknameMention(s.accusedUserId)} said: _"${s.content}"_.
      > (provided by ${nicknameMention(s.userId)}) ${hideLinkEmbed(s.url)}`
    ).join('\n\n'),

  realTalkIsCap: ({ content, url, userId }: StatementRecord): string =>
    stripIndents`**#RealTalk**, the following statement made by ${nicknameMention(userId)} is cap:
      _"${content}"_
      ${hideLinkEmbed(url)}`,

  realTalkNoWitnesses: (): InteractionReplyOptions =>
    quietReply('**#RealTalk**, you need witnesses (online, in chat, and not deafened) to make a statement.'),

  realTalkRecord: (userId: string, statement: string): string =>
    stripIndents`**The following is provided under the terms of #RealTalk**
      Date: ${time(new Date())}
      ${nicknameMention(userId)}: _"${statement}"_`,

  realTalkEmojiReaction: (userId: string, statement: string): string =>
    stripIndents`${statement}

      (Created with #RealTalk emoji by ${nicknameMention(userId)})`,

  realTalkStats: (stats: RealTalkStats): string =>
    stripIndents`**#RealTalk Stats**
      ${Object.keys(stats).map(userId => {
        const { uses, accusations } = stats[userId];

        let message: string = `> ${nicknameMention(userId)}: `;
        const usesPart: string = `${uses} ${pluralizeIf('use', uses)}`;
        const accusationsPart: string = `${accusations} ${pluralizeIf('accusation', accusations)}`;

        if (uses && accusations) {
          message += `${usesPart}, ${accusationsPart}`;
        } else if (uses) {
          message += usesPart;
        } else {
          message += accusationsPart;
        }

        return message;
      }).join('\n')}`,

  realTalkStatsCompact: ({ uniqueUsers, uses }: RealTalkStatsCompact): string =>
    `**#RealTalk** has been used ${uses} ${pluralizeIf('time', uses)} by ${uniqueUsers} ${pluralizeIf('user', uniqueUsers)}`,

  realTalkQuiz: (statement: string, duration: number): string =>
    stripIndents`
      Who's the type of person to say: _"${statement}"_?
      You have ${msConvert(duration, 'Second')}s to respond in chat with: #RealTalk @Username
      _Ex: #RealTalk @JohnDoe_`,

  realTalkQuizEnd: (accusedUserId: string, userIds: string[]): string =>
    stripIndents`
      ${isEmpty(userIds) ? 'No one' : userIds.map(nicknameMention).join(', ')} got it right.
      ${nicknameMention(accusedUserId)} is the type of person that would say that tho...`,

  throttleCoolDown: (duration: number): InteractionReplyOptions =>
    quietReply(`**#RealTalk**, chill... ${msConvert(duration, 'Second')}s left`),

};
