import { Guild, GuildMember, TextChannel, User } from 'discord.js';

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

/**
 * Returns the client's current guild.
 *
 * @returns {Guild}
 */
export const getGuild = (): Guild =>
  client?.guilds.cache.get(process.env.GUILD_ID) ?? null;

/**
 * Returns a member from the current client's guild.
 *
 * @param   {string} userId - id of user to fetch.
 * @returns {GuildMember}
 */
export const getMember = (userId: string): GuildMember =>
  getGuild()?.members.cache.get(userId) ?? null;

/**
 * Returns a user from the current client's guild.
 *
 * @param   {string} userId - id of user to fetch.
 * @returns {User}
 */
export const getUser = (userId: string): User =>
  getMember(userId)?.user ?? null;

/**
 * Returns active users in a guild channel with bots filtered out.
 *
 * @param   {string} channelId - guild channel id.
 * @returns {User[]}
 */
export const getActiveUsersInChannel = (channelId: string): User[] =>
  (client.channels.cache.get(channelId) as TextChannel)
    ?.members
    .filter(({ presence, voice }) =>
      voice.channelId === channelId && presence?.status === 'online' && !voice.deaf)
    .map(member => member.user)
    .filter(user => !user.bot)
    ?? null;
