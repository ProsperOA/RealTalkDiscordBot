import { CommandInteraction, Guild, GuildMember, User } from "discord.js";
import { memberNicknameMention } from "@discordjs/builders";

import { Config } from "../utils/config";
import { client } from "../index";

interface Structure<T = any> {
  partial: boolean;
  fetch: (force?: boolean) => Promise<T>;
  [key: string]: any;
}

export const USER_MENTION_REGEX: Readonly<RegExp> = /^<@[0-9]{18}>$/;
export const NICKNAME_MENTION_REGEX: Readonly<RegExp> = /^<@![0-9]{18}>$/;

export const isMention = (mention: string): boolean =>
  mention
    ? new RegExp(`${USER_MENTION_REGEX.source}|${NICKNAME_MENTION_REGEX.source}`)
      .test(mention)
    : false;

export const extractUserIdFromMention = (mention: string): string =>
  isMention(mention) ? mention.match(/[0-9]{18}/)[0] : "";

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

export const nicknameMention = (userId: string): string => {
  const user: User = getUser(userId);

  if (!user) {
    return formatUserId(userId);
  }

  return Config.IsDev ? user.tag : memberNicknameMention(userId);
};

export const completeStructure = async <T = any>(structure: Structure<T>, force: boolean = true): Promise<T> =>
  structure.partial ? await structure.fetch(force) : structure as any as T;

export const delayDeleteReply = (delay: number) =>
  (interaction: CommandInteraction): Promise<void> =>
    new Promise(resolve => {
      setTimeout(async () => {
        await interaction.deleteReply();
        return resolve();
      }, delay);
    });
