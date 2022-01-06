import { Client, Guild, User } from 'discord.js';

/**
 * Return a user from client's guild.
 *
 * @param   {Client} - Reference to client object.
 * @returns {User}
 */
export const getUser = (client: Client, userId: string): User => {
  const guild: Guild = client.guilds.cache.get(process.env.GUILD_ID);
  return guild.members.cache.get(userId).user;
};
