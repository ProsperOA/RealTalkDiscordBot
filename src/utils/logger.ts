import * as chalk from "chalk";
import { isEmpty, snakeCase } from "lodash";
import { stripIndents } from "common-tags";

import {
  CacheType,
  CommandInteraction,
  CommandInteractionOption,
  MessageReaction,
  User,
} from "discord.js";

import { Config, indent } from "../utils";

type LogFunction =
  Console["log"] |
  Console["info"] |
  Console["warn"] |
  Console["error"] |
  Console["debug"];

export interface CustomLogOptions {
  [name: string]: string;
}

enum BaseLogLevel {
  Debug = "debug",
  Error = "error",
  Info = "info",
  Warn = "warn",
}

enum CustomLogLevel {
  Interaction = "interaction",
  MessageReaction = "messageReaction",
}

export interface CustomMessageReaction {
  reaction: MessageReaction;
  user: User;
}

type CustomLogOutput = CommandInteraction | CustomMessageReaction;

export type CustomLogData =
  {[CustomLogLevel.Interaction]: CommandInteraction} |
  {[CustomLogLevel.MessageReaction]: CustomMessageReaction};

type LogColorType =
  "custom" |
  BaseLogLevel.Debug |
  BaseLogLevel.Error |
  BaseLogLevel.Info |
  BaseLogLevel.Warn;

const COLOR_FUNCTIONS: Readonly<Record<LogColorType, chalk.ChalkFunction>> = {
  custom: chalk.magenta,
  debug: chalk.cyanBright,
  error: chalk.red,
  info: chalk.blueBright,
  warn: chalk.yellow,
};

const baseLogger = (level: BaseLogLevel | CustomLogLevel, message: string | Error, options: any[] = []): void => {
  const colorFn: chalk.ChalkFunction =
    (COLOR_FUNCTIONS as any)[level] || COLOR_FUNCTIONS.custom;

  const output: string =
    `[${Config.ServiceName}] ${new Date().toISOString()} ${snakeCase(level).toUpperCase()} ${message}`;

  const logFn: LogFunction = (console as any)[level] || console.log;

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
    : options.map(option => indent(
      `Type: ${option.type}\nName: ${option.name}\nValue: ${formatSubCommandValue(option)}`,
      2,
      ". "
    )).join("\n\n");

const formatCommandOptions = (options: Readonly<CommandInteractionOption<CacheType>[]>): string => {
  let output: string = "";

  options.forEach((option, index) => {
    output += `\nCommand Option #${index + 1}:\n`
      + indent(`Type: ${option.type}\nName: ${option.name}`, 1, ". ") + "\n\n";

    if (option.type === "SUB_COMMAND" && !isEmpty(option.options)) {
      output += indent(`Command Option #${index + 1} Options:`, 1, ". ")
        + `\n${formatSubCommands(option.options)}`;
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

  return `\n${indent(output, 2)}`;
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

  return `\n${indent(output, 2)}`;
};

const customLogger = (data: CustomLogData, options?: CustomLogOptions): void => {
  const level: string = Object.keys(data)[0];
  const output: CustomLogOutput = Object.values(data)[0];
  const logFn: LogFunction = baseLogger.bind(null, level);

  switch (level) {
    case CustomLogLevel.Interaction:
      return logFn(buildInteractionOutput(output as CommandInteraction, options));
    case CustomLogLevel.MessageReaction:
      return logFn(buildMessageReactionOutput(output as CustomMessageReaction, options));
  }
};

export const logger = {
  custom:
    customLogger,
  debug: (message: string, ...options: any[]): void =>
    baseLogger(BaseLogLevel.Debug, message, options),
  error: (message: string | Error, ...options: any[]): void =>
    baseLogger(BaseLogLevel.Error, message, options),
  info: (message: string, ...options: any[]): void =>
    baseLogger(BaseLogLevel.Info, message, options),
  warn: (message: string, ...options: any[]): void =>
    baseLogger(BaseLogLevel.Warn, message, options),
};
