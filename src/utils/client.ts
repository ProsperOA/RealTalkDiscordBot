import { CommandInteraction, Guild, GuildMember, MessageMentions, User } from "discord.js";
import { memberNicknameMention } from "@discordjs/builders";

import { Config } from "../utils/config";
import { client } from "../index";

interface Structure<T> {
  partial: boolean;
  fetch: (force?: boolean) => Promise<T>;
  [key: string]: any;
}

export const getUserIdFromMention = (mention: string): string =>
  mention.matchAll(MessageMentions.USERS_PATTERN).next().value?.[1];

export const getGuild = (): Guild =>
  client?.guilds.cache.get(process.env.GUILD_ID) ?? null;

export const getMember = (userId: string): GuildMember =>
  getGuild()?.members.cache.get(userId) ?? null;

export const getUser = (userId: string): User =>
  getMember(userId)?.user ?? null;

const formatUserId = (userId: string): string =>
  `UserID::${userId}`;

export const getUsername = (userId: string): string =>
  getUser(userId)?.username ?? formatUserId(userId);

export const getDisplayName = (userId: string): string =>
  getMember(userId)?.displayName ?? getUsername(userId);

export const nicknameMention = (userId: string): string => {
  const user: User = getUser(userId);

  if (!user) {
    return formatUserId(userId);
  }

  return Config.IsDev ? user.tag : memberNicknameMention(userId);
};

export const completeStructure = async <T>(obj: Structure<T>): Promise<T> =>
  obj.partial ? await obj.fetch() : obj as any as T;

export const delayDeleteReply = (delay: number) =>
  (interaction: CommandInteraction): Promise<void> =>
    new Promise(resolve => {
      setTimeout(async () => {
        await interaction.deleteReply();
        return resolve();
      }, delay);
    });
