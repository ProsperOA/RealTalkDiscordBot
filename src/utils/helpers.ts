import { Client, Collection, Guild, GuildMember, User } from 'discord.js';

const { GUILD_ID } = process.env;

/**
 * Returns users in the client's guild.
 *
 * @param   {Client} - Reference to client object.
 * @returns {User[]}
 */
export const getUsers = (client: Client): User[] => {
  const guild: Guild = client.guilds.cache.get(GUILD_ID);
  const members: Collection<string, GuildMember> = guild.members.cache;

  return members.map(member => member.user);
};
