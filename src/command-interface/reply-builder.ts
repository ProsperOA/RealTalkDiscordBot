import { hideLinkEmbed, memberNicknameMention, time } from '@discordjs/builders';
import { InteractionReplyOptions } from 'discord.js';

import { COMMAND_OPTION_REQUEST_CONTENT_LENGTH } from '.';
import { StatementRecord } from '../db/models/statements';

export const realTalkReply = {

  success: (userId: string, statement: string): string =>
    `**The following is provided under the terms of #RealTalk**
    Date: ${time(new Date())}
    ${memberNicknameMention(userId)}: _"${statement}"_`,

  invalidContentLength: (): InteractionReplyOptions => ({
    content: `**#RealTalk**, the statement must be ${COMMAND_OPTION_REQUEST_CONTENT_LENGTH} characters or less`,
    ephemeral: true,
  }),

};

export const listAllRealTalkReply = {

  success: (statements: StatementRecord[]) => statements.map(s =>
    `> **#RealTalk**, ${memberNicknameMention(s.user_id)} claims ${memberNicknameMention(s.accused_user_id)} said "${s.content}".
    > ${hideLinkEmbed(s.link)}`).join('\n\n'),

};

export const throttleReply = {

  coolDown: (duration: number): InteractionReplyOptions => ({
    content: `**#RealTalk**, chill... ${duration}s left`,
    ephemeral: true
  }),

};
