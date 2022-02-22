import { InteractionReplyOptions } from 'discord.js';
import { hideLinkEmbed, time } from '@discordjs/builders';
import { isEmpty } from 'lodash';
import { stripIndents } from 'common-tags';

import { RealTalkStats, RealTalkStatsCompact, StatementRecord } from '../db/models/statements';
import { nicknameMention, pluralizeIf } from '../utils';

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
      > **#RealTalk**, ${nicknameMention(s.user_id)} claims ${nicknameMention(s.accused_user_id)} said "${s.content}".
      > ${hideLinkEmbed(s.link)}`
    ).join('\n\n'),

  realTalkIsCap: ({ content, link, user_id }: StatementRecord): string =>
    stripIndents`**The following #RealTalk statement made by ${nicknameMention(user_id)} is cap:**
      _"${content}"_
      ${hideLinkEmbed(link)}`,

  realTalkNoWitnesses: (): InteractionReplyOptions =>
    quietReply('**#RealTalk**, you need witnesses (online, in chat, and not deafened) to make a statement.'),

  realTalkRecord: (userId: string, statement: string): string =>
    stripIndents`**The following is provided under the terms of #RealTalk**
      Date: ${time(new Date())}
      ${nicknameMention(userId)}: _"${statement}"_`,

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
      You have ${duration}s to respond in chat with: #RealTalk @Username
      _Ex: #RealTalk @JohnDoe_`,

  realTalkQuizEnd: (accusedUserId: string, userIds: string[]): string =>
    stripIndents`
      ${isEmpty(userIds) ? 'No one' : userIds.map(nicknameMention).join(', ')} got it right.
      ${nicknameMention(accusedUserId)} is the type of person that would say that tho...`,

  throttleCoolDown: (duration: number): InteractionReplyOptions =>
    quietReply(`**#RealTalk**, chill... ${duration}s left`),

};
