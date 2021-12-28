import { memberNicknameMention, time } from '@discordjs/builders';
import { InteractionReplyOptions } from 'discord.js';

export const realTalkReply = {

  success: (userId: string, statement: string): string =>
    `**The following is provided under the terms of #RealTalk**
    Date: ${time(new Date())}
    ${memberNicknameMention(userId)}: _"${statement}"_`,

  fail: (username: string): InteractionReplyOptions => ({
    content: `**#RealTalk**, ${username} doesn't exist in this server.`,
    ephemeral: true,
  }),

};

export const throttleReply = {

  coolDown: (duration: number): InteractionReplyOptions => ({
    content: `**#RealTalk**, chill... ${duration}s left`,
    ephemeral: true
  }),

};
