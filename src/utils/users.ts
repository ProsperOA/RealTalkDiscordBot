import { Guild, GuildChannel, GuildMember, User } from 'discord.js';

import { client } from '../index';

export const USER_MENTION_REGEX: Readonly<RegExp> = /^<@[0-9]{18}>$/;
export const NICKNAME_MENTION_REGEX: Readonly<RegExp> = /^<@![0-9]{18}>$/;

/**
 * Tests whether a mention is a valid user or nickname mention.
 *
 * @param   {string} mention - mention to test.
 * @returns {boolean}
 */
export const isMention = (mention: string): boolean =>
  new RegExp(`${USER_MENTION_REGEX.source}|${NICKNAME_MENTION_REGEX.source}`)
    .test(mention);

/**
 * Extracts a user id from nickname mention.
 *
 * @param   {string} mention - user tag to format.
 * @returns {string}
 */
export const extractUserIdFromMention = (mention: string): string =>
  isMention(mention) ? mention.match(/[0-9]{18}/)[0] : '';

export const getGuild = (): Guild =>
  client?.guilds.cache.get(process.env.GUILD_ID) ?? null;

/**
 * Returns a member from the current client's guild.
 *
 * @param   {string} userId - id of user to fetch.
 * @returns {GuildMember}
 */
export const getMember = (userId: string): GuildMember => {
  return getGuild()?.members.cache.get(userId) ?? null;
};

/**
 * Returns a user from the current client's guild.
 *
 * @param   {string} userId - id of user to fetch.
 * @returns {User}
 */
export const getUser = (userId: string): User =>
  getMember(userId)?.user ?? null;

export const isOnlineAndListening = (member: GuildMember): boolean =>
  member.presence?.status === 'online' && !member.voice.deaf;

export const getActiveUsersInChannel = (channelId: string): User[] => {
  const channel: GuildChannel = client.channels.cache.get(channelId) as GuildChannel;

  return channel.members
    ?.filter(isOnlineAndListening)
    .map(member => member.user)
    .filter(user => !user.bot)
    ?? null;
};