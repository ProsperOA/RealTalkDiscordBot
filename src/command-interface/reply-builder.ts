import { hideLinkEmbed, memberNicknameMention, time } from '@discordjs/builders';
import { InteractionReplyOptions } from 'discord.js';

import { StatementRecord } from '../db/models/statements';

export default {

  internalError: (): InteractionReplyOptions => ({
    content: '**#RealTalk**, an error occurred. 😬',
    ephemeral: true,
  }),

  invalidStatementLength: (length: number): InteractionReplyOptions => ({
    content: `**#RealTalk**, the statement must be ${length} characters or less`,
    ephemeral: true,
  }),

  realTalkHistory: (statements: StatementRecord[]) => statements.map(s =>
    `> **#RealTalk**, ${memberNicknameMention(s.user_id)} claims ${memberNicknameMention(s.accused_user_id)} said "${s.content}".
    > ${hideLinkEmbed(s.link)}`).join('\n\n'),

  realTalkRecord: (userId: string, statement: string): string =>
    `**The following is provided under the terms of #RealTalk**
    Date: ${time(new Date())}
    ${memberNicknameMention(userId)}: _"${statement}"_`,

  throttleCoolDown: (duration: number): InteractionReplyOptions => ({
    content: `**#RealTalk**, chill... ${duration}s left`,
    ephemeral: true
  }),

};
