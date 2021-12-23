import { Client, Collection, Guild, GuildMember, User } from 'discord.js';

const { GUILD_ID } = process.env;

export const getUsers = (client: Client): User[] => {
  const guild: Guild = client.guilds.cache.get(GUILD_ID);
  const members: Collection<string, GuildMember> = guild.members.cache;

  return members.map(member => member.user);
};
