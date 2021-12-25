import { Client, Collection, Guild, GuildMember, User } from 'discord.js';

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
