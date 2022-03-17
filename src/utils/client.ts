import { Guild, GuildMember, Message, TextChannel, User } from 'discord.js';
import { memberNicknameMention } from '@discordjs/builders';

import { Config } from './config';
import { client } from '../index';
import { logger } from './logger';

interface PartialStructure<T = any> {
  partial: boolean;
  fetch: (force?: boolean) => Promise<T>;
  [key: string]: any;
}

export const USER_MENTION_REGEX: Readonly<RegExp> = /^<@[0-9]{18}>$/;
export const NICKNAME_MENTION_REGEX: Readonly<RegExp> = /^<@![0-9]{18}>$/;

export const isMention = (mention: string): boolean =>
  new RegExp(`${USER_MENTION_REGEX.source}|${NICKNAME_MENTION_REGEX.source}`)
    .test(mention);

export const extractUserIdFromMention = (mention: string): string =>
  isMention(mention) ? mention.match(/[0-9]{18}/)[0] : '';

export const getGuild = (): Guild =>
  client?.guilds.cache.get(process.env.GUILD_ID) ?? null;

export const getChannel = <T>(channelId: string): T =>
  client?.channels.cache.get(channelId) as any as T ?? null;

export const getMember = (userId: string): GuildMember =>
  getGuild()?.members.cache.get(userId) ?? null;

export const getUser = (userId: string): User =>
  getMember(userId)?.user ?? null;

const formatUserId = (userId: string): string =>
  `UserID::${userId}`;

export const getUsername = (userId: string): string =>
  getUser(userId)?.username ?? formatUserId(userId);

export const nicknameMention = (userId: string): string => {
  const user: User = getUser(userId);

  if (!user) {
    return formatUserId(userId);
  }

  return Config.IsDev ? user.tag : memberNicknameMention(userId);
};

const isActiveInChannel = (channelId: string) => ({ presence, voice }: GuildMember): boolean =>
  voice.channelId === channelId && presence?.status === 'online' && !voice.deaf;

export const getActiveUsersInChannel = (channelId: string): User[] =>
  getChannel<TextChannel>(channelId)?.members
    .filter(isActiveInChannel(channelId))
    .map(member => member.user)
    .filter(user => !user.bot)
    ?? null;

export const buildMessageUrl = ({ channelId, guildId, id }: Message): string =>
  `${Config.ChannelsURL}/${guildId}/${channelId}/${id}`;

export const fetchFull = async <T>(partial: PartialStructure<T>, force?: boolean): Promise<T> => {
  let fullStructure: T = null;

  try {
    fullStructure = await partial.fetch(force);
  } catch (error) {
    logger.error(error);
  }

  return fullStructure;
};
