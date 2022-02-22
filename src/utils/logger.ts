import * as chalk from 'chalk';
import { isEmpty, isNil } from 'lodash';
import { stripIndents } from 'common-tags';

import {
  CacheType,
  CommandInteraction,
  CommandInteractionOption,
  MessageReaction,
  User,
} from 'discord.js';

import { SERVICE_NAME } from '../index';
import { multilineIndent } from './functions';

export interface CustomLogOptions {
  [name: string]: string;
}

type LogTypeDebug = 'debug';
type LogTypeError = 'error';
type LogTypeInfo = 'info';
type LogTypeInteraction = 'interaction';
type LogTypeMessageReaction = 'messageReaction';
type LogTypeWarn = 'warn';

type CustomLogType = LogTypeInteraction | LogTypeMessageReaction;

type LogType =
  CustomLogType |
  LogTypeDebug |
  LogTypeError |
  LogTypeInfo |
  LogTypeWarn;

enum PRINTABLE_CUSTOM_LOG_TYPE {
  interaction = 'interaction',
  messageReaction = 'message_reaction',
}

export interface CustomMessageReaction {
  reaction: MessageReaction;
  user: User;
}

type CustomLogOutput = CommandInteraction | CustomMessageReaction;

export type CustomLogData = {
  [type in CustomLogType]?: CustomLogOutput
};

const LOG_TYPE_DEBUG: Readonly<LogTypeDebug> = 'debug';
const LOG_TYPE_ERROR: Readonly<LogTypeError> = 'error';
const LOG_TYPE_INFO: Readonly<LogTypeInfo> = 'info';
const LOG_TYPE_INTERACTION: Readonly<LogTypeInteraction> = 'interaction';
const LOG_TYPE_MESSAGE_REACTION: Readonly<LogTypeMessageReaction> = 'messageReaction';
const LOG_TYPE_WARN: Readonly<LogTypeWarn> = 'warn';

type LogColorType =
  'custom' |
  LogTypeDebug |
  LogTypeError |
  LogTypeInfo |
  LogTypeWarn;

const COLOR_FUNCTIONS: Record<LogColorType, chalk.ChalkFunction> = {
  custom: chalk.magenta,
  debug: chalk.blueBright,
  error: chalk.red,
  info: chalk.blue,
  warn: chalk.yellow,
};

/**
 * Logs output to console.
 *
 * @param {LogType}        type    - type of log message.
 * @param {string | Error} message - message to log to console.
 * @param {any[]}          options - additional logging options.
 */
const baseLogger = (type: LogType, message: string | Error, options?: any[]): void => {
  const colorFn = (COLOR_FUNCTIONS as any)[type] || COLOR_FUNCTIONS.custom;

  const baseOutput: any[] = [
    `[${SERVICE_NAME}] ${type.toUpperCase()} ${message}`
  ];

  const output: any[] = isEmpty(options)
    ? baseOutput
    : [ ...baseOutput, ...options ];

  const logFnMap: any = {
    default: LOG_TYPE_INFO,
    error: LOG_TYPE_ERROR,
    info: LOG_TYPE_INFO,
    warn: LOG_TYPE_WARN,
  };

  const logFn = logFnMap[type] || logFnMap.default;

  (console as any)[logFn](colorFn(...output));
};

/**
 * Formats command middleware options.
 *
 * @param   {CustomLogOptions} options - List of middleware options.
 * @returns {string}
 */
const formatCustomLogOptions = (options: CustomLogOptions): string =>
  isNil(options)
    ? ''
    : Object.keys(options).map(option => `${option}: ${options[option]}`).join('\n');

/**
 * Formats application subcommand values.
 *
 * @param   {CommandInteractionOption} opt - Subcommand to format.
 * @returns {string}
 */
const formatSubCommandValue = (opt: CommandInteractionOption): string => {
  switch (opt.type) {
    case 'USER':
      return `${opt.value} (${opt.user.tag})`;
    default:
      return String(opt.value);
  }
};

/**
 * Formats application subcommands.
 *
 * @param   {CommandInteractionOption[]} options - List of subcommands.
 * @returns {string}
 */
const formatSubCommands = (options: CommandInteractionOption[]): string =>
  isEmpty(options)
    ? ''
    : options.map(option =>
      `> > Type: ${option.type}
      > > Name: ${option.name}
      > > Value: ${formatSubCommandValue(option)}`
    ).join('\n\n');

/**
 * Formats application command options.
 *
 * @param   {Readonly<CommandInteraction<CacheType>[]} interaction - List of interaction options.
 * @returns {string}
 */
const formatCommandOptions = (options: Readonly<CommandInteractionOption<CacheType>[]>): string => {
  let output: string = '';

  options.forEach((option, index) => {
    output += `\nCommand Option #${index + 1}:
      > Type: ${option.type}
      > Name: ${option.name}`;

    if (option.type === 'SUB_COMMAND' && !isEmpty(option.options)) {
      output += `\n\n> Command Option #${index + 1} Options:
        ${formatSubCommands(option.options)}`;
    }
  });

  return output;
};

/**
 * Formats a portion of the interaction message based on interaction type.
 *
 * @param   {CommandInteraction} interaction - Reference to interaction object.
 * @param   {CustomLogOptions} options       - Additional logging options.
 * @returns {string}
 */
const formatInteraction = (interaction: CommandInteraction,  options: CustomLogOptions): string => {
  let output: string = '';

  switch (interaction.type) {
    case 'APPLICATION_COMMAND':
      output += `Command Name: ${interaction.commandName}
        ${formatCustomLogOptions(options)}\n`;

      if ('options' in interaction) {
        output += formatCommandOptions(interaction.options.data);
      }
      break;
    default:
      logger.warn(`Invalid command interaction type: ${interaction.type}`);
      break;
  }

  return output;
};

/**
 * Builds formatted interaction message.
 *
 * @param   {CommandInteraction} interaction - Reference to interaction object.
 * @param   {CustomLogOptions} options       - Additional logging options.
 * @returns {string}
 */
const buildInteractionOutput = (interaction: CommandInteraction, options: CustomLogOptions): string => {
  const { type, user } = interaction;

  const output: string = stripIndents`
    Type: ${type}
    Created: ${interaction.createdAt.toUTCString()}
    User: ${user.tag}
    ${formatInteraction(interaction, options)}`;

  return `\n${multilineIndent(output, 2)}`;
};

const buildMessageReactionOutput = (data: CustomMessageReaction, options?: CustomLogOptions): string => {
  const {
    reaction: { count, emoji, message },
    user,
  } = data;

  const output = stripIndents`
    User: ${user.tag}
    Message Author: ${message.author.tag}
    Message Content: ${chalk.italic(message.content)}
    Message Created: ${message.createdAt.toUTCString()}
    Emoji Name: ${emoji.name}
    Reaction Count: ${count}
    ${formatCustomLogOptions(options)}`;

  return `\n${multilineIndent(output, 2)}`;
};

const customLogger = (data: CustomLogData, options?: CustomLogOptions): void => {
  const type: CustomLogType = Object.keys(data)[0] as CustomLogType;
  const printableLogType: string = PRINTABLE_CUSTOM_LOG_TYPE[type];

  if (!printableLogType) {
    return logger.warn(`Invalid log type: ${type}\nOutput: ${JSON.stringify(data)}`);
  }

  const outputData: CustomLogOutput = data[type];
  const log: (message: string) => void = baseLogger.bind(null, printableLogType);

  switch (type) {
    case LOG_TYPE_INTERACTION:
      return log(buildInteractionOutput(outputData as CommandInteraction, options));
    case LOG_TYPE_MESSAGE_REACTION:
      return log(buildMessageReactionOutput(outputData as CustomMessageReaction, options));
  }
};

export const logger = {
  custom: (data: CustomLogData, options?: CustomLogOptions): void =>
    customLogger(data, options),
  debug: (message: string, ...options: any[]): void =>
    baseLogger(LOG_TYPE_DEBUG, message, options),
  error: (message: string | Error, ...options: any[]): void =>
    baseLogger(LOG_TYPE_ERROR, message, options),
  info: (message: string, ...options: any[]): void =>
    baseLogger(LOG_TYPE_INFO, message, options),
  warn: (message: string, ...options: any[]): void =>
    baseLogger(LOG_TYPE_WARN, message, options),
};
