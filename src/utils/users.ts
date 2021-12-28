import { Client, Collection, Guild, GuildMember, User } from 'discord.js';
import { find } from 'lodash';

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
 * Curried function that returns a {User} matching a filter.
 *
 * @param   {User[]} users  - List of users.
 * @param   {object} filter - Key/value to filter by.
 * @returns {User}
 */
export const findUser = (users: User[]) => (filter: object) =>
  find(users, filter) as User;

/**
 * Returns users in the client's guild.
 *
 * @param   {Client} - Reference to client object.
 * @returns {User[]}
 */
export const getUsers = (client: Client): User[] => {
  const guild: Guild = client.guilds.cache.get(process.env.GUILD_ID);
  const members: Collection<string, GuildMember> = guild.members.cache;

  return members.map(member => member.user);
};
