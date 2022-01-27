import { hideLinkEmbed, time } from '@discordjs/builders';
import { InteractionReplyOptions } from 'discord.js';
import { isEmpty } from 'lodash';

import { RealTalkStats, RealTalkStatsCompact, StatementRecord } from '../db/models/statements';
import { nicknameMention, pluralizeIf } from '../utils';

interface ReplyBuilder {
  internalError: () => InteractionReplyOptions;
  invalidStatementLength: (length: number) => InteractionReplyOptions;
  realTalkIsCap: (statement: StatementRecord) => string;
  realTalkHistory: (statements: StatementRecord[]) => string;
  realTalkRecord: (userId: string, statement: string) => string;
  realTalkStats: (stats: RealTalkStats) => string;
  realTalkStatsCompact: (stats: RealTalkStatsCompact) => string;
  realTalkQuiz: (statement: string, duration: number) => string;
  realTalkQuizEnd: (accusedUserId: string, userIds: string[]) => string;
  throttleCoolDown: (duration: number) => InteractionReplyOptions;
}

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

  realTalkIsCap: ({ content, link, user_id }: StatementRecord): string =>
    `**The following #RealTalk statement made by ${nicknameMention(user_id)} is cap:**
    _"${content}"_
    ${hideLinkEmbed(link)}`,


  realTalkHistory: (statements: StatementRecord[]): string =>
    statements.map(s =>
      `> **#RealTalk**, ${nicknameMention(s.user_id)} claims ${nicknameMention(s.accused_user_id)} said "${s.content}".
      > ${hideLinkEmbed(s.link)}`
    ).join('\n\n'),

  realTalkRecord: (userId: string, statement: string): string =>
    `**The following is provided under the terms of #RealTalk**
    Date: ${time(new Date())}
    ${nicknameMention(userId)}: _"${statement}"_`,

  realTalkStats: (stats: RealTalkStats): string =>
    `**#RealTalk Stats**
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
    `Who's the type of person to say: _"${statement}"_?
      You have ${duration}s to respond in chat with: #RealTalk @Username
      Ex: #RealTalk @JohnDoe`,

  realTalkQuizEnd: (accusedUserId: string, userIds: string[]): string =>
    `${isEmpty(userIds) ? 'No one' : userIds.map(nicknameMention).join(', ')} got it right.
    ${nicknameMention(accusedUserId)} is the type of person that would say that...`,

  throttleCoolDown: (duration: number): InteractionReplyOptions =>
    quietReply(`**#RealTalk**, chill... ${duration}s left`),

} as ReplyBuilder;
