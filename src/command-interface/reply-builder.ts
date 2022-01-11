import { hideLinkEmbed, memberNicknameMention, time } from '@discordjs/builders';
import { InteractionReplyOptions } from 'discord.js';

import { RealTalkStats, RealTalkStatsCompact, StatementRecord } from '../db/models/statements';
import { pluralizeIf } from '../utils';

interface ReplyBuilder {
  internalError: () => InteractionReplyOptions;
  invalidStatementLength: (length: number) => InteractionReplyOptions;
  realTalkHistory: (statements: StatementRecord[]) => string;
  realTalkRecord: (userId: string, statement: string) => string;
  realTalkStats: (stats: RealTalkStats) => string;
  realTalkStatsCompact: (stats: RealTalkStatsCompact) => string;
  throttleCoolDown: (duration: number) => InteractionReplyOptions;
}

export default {

  internalError: (): InteractionReplyOptions => ({
    content: '**#RealTalk**, an error occurred. \:grimacing:',
    ephemeral: true,
  }),

  invalidStatementLength: (length: number): InteractionReplyOptions => ({
    content: `**#RealTalk**, the statement must be ${length} characters or less`,
    ephemeral: true,
  }),

  realTalkHistory: (statements: StatementRecord[]): string =>
    statements.map(s =>
      `> **#RealTalk**, ${memberNicknameMention(s.user_id)} claims ${memberNicknameMention(s.accused_user_id)} said "${s.content}".
      > ${hideLinkEmbed(s.link)}`
    ).join('\n\n'),

  realTalkRecord: (userId: string, statement: string): string =>
    `**The following is provided under the terms of #RealTalk**
    Date: ${time(new Date())}
    ${memberNicknameMention(userId)}: _"${statement}"_`,

  realTalkStats: (stats: RealTalkStats): string =>
    `**#RealTalk Stats**
    ${Object.keys(stats).map(userId => {
      const { uses, accusations } = stats[userId];

      let message: string = `> ${memberNicknameMention(userId)}: `;
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

  throttleCoolDown: (duration: number): InteractionReplyOptions => ({
    content: `**#RealTalk**, chill... ${duration}s left`,
    ephemeral: true
  }),

} as ReplyBuilder;
