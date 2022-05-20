import * as chalk from "chalk";
import Bugsnag from "@bugsnag/node";
import { isEmpty, snakeCase } from "lodash";
import { stripIndents } from "common-tags";

import {
  CacheType,
  CommandInteraction,
  CommandInteractionOption,
  MessageReaction,
  User,
} from "discord.js";

import { Config, multilineIndent } from "../utils";

type LogFunction =
  Console["log"] |
  Console["info"] |
  Console["warn"] |
  Console["error"] |
  Console["debug"];

export interface CustomLogOptions {
  [name: string]: string;
}

enum BaseLogType {
  Debug = "debug",
  Error = "error",
  Info = "info",
  Warn = "warn",
}

enum CustomLogType {
  Interaction = "interaction",
  MessageReaction = "messageReaction",
}

export interface CustomMessageReaction {
  reaction: MessageReaction;
  user: User;
}

type CustomLogOutput = CommandInteraction | CustomMessageReaction;

export type CustomLogData =
  {[CustomLogType.Interaction]: CommandInteraction} |
  {[CustomLogType.MessageReaction]: CustomMessageReaction};

type LogColorType =
  "custom" |
  BaseLogType.Debug |
  BaseLogType.Error |
  BaseLogType.Info |
  BaseLogType.Warn;

const COLOR_FUNCTIONS: Readonly<Record<LogColorType, chalk.ChalkFunction>> = {
  custom: chalk.magenta,
  debug: chalk.cyanBright,
  error: chalk.red,
  info: chalk.blueBright,
  warn: chalk.yellow,
};

const baseLogger = (type: BaseLogType | CustomLogType, message: string | Error, options: any[] = []): void => {
  if (type === BaseLogType.Error) {
    Bugsnag.notify(message);
  }

  const colorFn: chalk.ChalkFunction =
    COLOR_FUNCTIONS[type as LogColorType] || COLOR_FUNCTIONS.custom;

  const output: string =
    `[${Config.ServiceName}] ${snakeCase(type).toUpperCase()} ${message}`;

  const logFn: LogFunction = (console as any)[type] || console.log;

  logFn(colorFn(output, ...options));
};

const formatCustomLogOptions = (options: CustomLogOptions): string =>
  isEmpty(options)
    ? ""
    : Object.keys(options).map(option => `${option}: ${options[option]}`).join("\n");

const formatSubCommandValue = (option: CommandInteractionOption): string => {
  switch (option.type) {
    case "USER":
      return `${option.value} (${option.user.tag})`;
    default:
      return String(option.value);
  }
};

const formatSubCommands = (options: CommandInteractionOption[]): string =>
  isEmpty(options)
    ? ""
    : options.map(option =>
      `> > Type: ${option.type}
      > > Name: ${option.name}
      > > Value: ${formatSubCommandValue(option)}`
    ).join("\n\n");

const formatCommandOptions = (options: Readonly<CommandInteractionOption<CacheType>[]>): string => {
  let output: string = "";

  options.forEach((option, index) => {
    output += `\nCommand Option #${index + 1}:
      > Type: ${option.type}
      > Name: ${option.name}`;

    if (option.type === "SUB_COMMAND" && !isEmpty(option.options)) {
      output += `\n\n> Command Option #${index + 1} Options:
        ${formatSubCommands(option.options)}`;
    }
  });

  return output;
};

const formatInteraction = (interaction: CommandInteraction,  options: CustomLogOptions): string => {
  let output: string = "";

  switch (interaction.type) {
    case "APPLICATION_COMMAND":
      output += `Command Name: ${interaction.commandName}
        ${formatCustomLogOptions(options)}
        ${formatCommandOptions(interaction.options.data)}`;
      break;
    default:
      logger.warn(`Invalid command interaction type: ${interaction.type}`);
      break;
  }

  return output;
};

const buildInteractionOutput = (interaction: CommandInteraction, options: CustomLogOptions): string => {
  const { type, user }: CommandInteraction = interaction;

  const output: string = stripIndents`
    Type: ${type}
    Created: ${interaction.createdAt.toISOString()}
    User: ${user.tag}
    ${formatInteraction(interaction, options)}`;

  return `\n${multilineIndent(output, 2)}`;
};

const buildMessageReactionOutput = (data: CustomMessageReaction, options?: CustomLogOptions): string => {
  const {
    reaction: { count, emoji, message },
    user,
  }: CustomMessageReaction = data;

  const output = stripIndents`
    User: ${user.tag}
    Message Author: ${message.author.tag}
    Message Content: ${chalk.italic(message.content)}
    Message Created: ${message.createdAt.toISOString()}
    Emoji Name: ${emoji.name}
    Reaction Count: ${count}
    ${formatCustomLogOptions(options)}`;

  return `\n${multilineIndent(output, 2)}`;
};

const customLogger = (data: CustomLogData, options?: CustomLogOptions): void => {
  const type: string = Object.keys(data)[0];
  const isValidLogType: boolean = Object.values<string>(CustomLogType).includes(type);

  if (!isValidLogType) {
    return logger.warn(`Invalid custom log type: ${type}`);
  }

  const output: CustomLogOutput = (data as any)[type];
  const logFn: LogFunction = baseLogger.bind(null, type);

  switch (type) {
    case CustomLogType.Interaction:
      return logFn(buildInteractionOutput(output as CommandInteraction, options));
    case CustomLogType.MessageReaction:
      return logFn(buildMessageReactionOutput(output as CustomMessageReaction, options));
  }
};

export const logger = {
  custom: (data: CustomLogData, options?: CustomLogOptions): void =>
    customLogger(data, options),
  debug: (message: string, ...options: any[]): void =>
    baseLogger(BaseLogType.Debug, message, options),
  error: (message: string | Error, ...options: any[]): void =>
    baseLogger(BaseLogType.Error, message, options),
  info: (message: string, ...options: any[]): void =>
    baseLogger(BaseLogType.Info, message, options),
  warn: (message: string, ...options: any[]): void =>
    baseLogger(BaseLogType.Warn, message, options),
};
