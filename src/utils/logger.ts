import { CacheType, CommandInteraction, CommandInteractionOption, MessageInteraction, MessageReaction } from 'discord.js';
import { isEmpty, isObject, isString } from 'lodash';
import { stripIndents } from 'common-tags';

import { SERVICE_NAME } from '../index';
import { multilineIndent } from './functions';

export interface CustomLogOptions {
  [name: string]: any;
}

export type CustomLogOutput = string | Error | {
  [type: string]: CommandInteraction | MessageReaction;
}

type LogTypeDefault = 'log';
type LogTypeError = 'error';
type LogTypeInfo = 'info';
type LogTypeInteraction = 'interaction';
type LogTypeMessageReaction = 'message_reaction';
type LogTypeWarn = 'warn';

type LogType =
  LogTypeError |
  LogTypeInfo |
  LogTypeInteraction |
  LogTypeMessageReaction |
  LogTypeWarn;

type CustomLogType = LogTypeInteraction | LogTypeMessageReaction;

const LOG_TYPE_DEFAULT: Readonly<LogTypeDefault> = 'log';
const LOG_TYPE_ERROR: Readonly<LogTypeError> = 'error';
const LOG_TYPE_INFO: Readonly<LogTypeInfo> = 'info';
const LOG_TYPE_INTERACTION: Readonly<LogTypeInteraction> = 'interaction';
const LOG_TYPE_MESSAGE_REACTION: Readonly<LogTypeMessageReaction> = 'message_reaction';
const LOG_TYPE_WARN: Readonly<LogTypeWarn> = 'warn';

interface OutputColors {
  custom: string;
  error: string;
  info: string;
  warn: string;
}

const OUTPUT_COLORS: Readonly<OutputColors> = {
  custom: '\x1b[35m%s\x1b[0m',
  error: '\x1b[31m%s\x1b[0m',
  info: '\x1b[36m%s\x1b[0m',
  warn: '\x1b[33m%s\x1b[0m',
};

/**
 * Logs output to console.
 *
 * @param {LogType}        type    - type of log message.
 * @param {string | Error} message - message to log to console.
 * @param {any[]}          opts    - additional logging options.
 */
const baseLogger = (type: LogType, message: string | Error, opts?: any[]): void => {
  const outputColor: string = (OUTPUT_COLORS as any)[type] || OUTPUT_COLORS.custom;

  const baseOutput: any[] = [
    outputColor,
    `[${SERVICE_NAME}] ${type.toUpperCase()} ${message}`
  ];

  const output: any[] = isEmpty(opts)
    ? baseOutput
    : [ ...baseOutput, ...opts ];

  const outputMap = {
    info: LOG_TYPE_INFO,
    warn: LOG_TYPE_WARN,
    error: LOG_TYPE_ERROR,
    custom: LOG_TYPE_DEFAULT,
  };

  const outputFn = (outputMap as any)[type] || outputMap.custom;

  (console as any)[outputFn](...output);
};

/**
 * Formats command middleware options.
 *
 * @param   {CustomLogOptions} options - List of middleware options.
 * @returns {string}
 */
const formatCustomLogOptions = (options: CustomLogOptions): string =>
  !isEmpty(options)
    ? Object.keys(options).map(option => isString(option)
      ? `${option}: ${options[option]}`
      : `${Object.keys(options[option]).map(key =>
          `${option}/${key}: ${[options][option][key]}`
        ).join('\n')}`
      ).join('\n')
    : '';

/**
 * Formats application subcommand values.
 *
 * @param   {CommandInteractionOption} option - Subcommand to format.
 * @returns {string}
 */
const formatSubCommandValue = (option: CommandInteractionOption): string => {
  switch (option.type) {
    case 'USER':
      return `${option.value} (${option.user.tag})`;
    default:
      return option.value as string;
  }
};

/**
 * Formats application subcommands.
 *
 * @param   {CommandInteractionOption[]} options - List of subcommands.
 * @returns {string}
 */
const formatSubCommands = (options: CommandInteractionOption[]): string =>
  !isEmpty(options)
    ? options.map(option =>
      `> > Type: ${option.type}
      > > Name: ${option.name}
      > > Value: ${formatSubCommandValue(option)}`
    ).join('\n\n')
  : '';

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
 * @param   {CustomLogOptions} opts        - Additional logging options.
 * @returns {string}
 */
const formatInteraction = (interaction: CommandInteraction | MessageInteraction,  opts: CustomLogOptions): string => {
  let output: string = '';

  switch (interaction.type) {
    case 'APPLICATION_COMMAND':
      output += `Command Name: ${interaction.commandName}
        ${formatCustomLogOptions(opts)}\n`;

      if ('options' in interaction) {
        output += formatCommandOptions(interaction.options.data);
      }
      break;
    default:
      logger.warn(`Cannot format interaction. ${interaction.type} is an invalid command interaction type.`);
      break;
  }

  return output;
};

/**
 * Builds formatted interaction message.
 *
 * @param   {CommandInteraction} interaction - Reference to interaction object.
 * @param   {CustomLogOptions} opts        - Additional logging options.
 * @returns {string}
 */
const buildInteractionOutput = (interaction: CommandInteraction | MessageInteraction, opts: CustomLogOptions): string => {
  const { type, user } = interaction;
  let createdAt: Date = new Date();

  if ('createdAt' in interaction) {
    createdAt = interaction.createdAt;
  }

  const output: string = stripIndents`
    Type: ${type}
    Created: ${createdAt.toUTCString()}
    User: ${user.tag}
    ${formatInteraction(interaction, opts)}`;

  return `\n${multilineIndent(output, 2)}`;
};

const buildMessageReactionOutput = (reaction: MessageReaction, opts?: CustomLogOptions): string => {
  const { count, emoji, message } = reaction;

  const output = stripIndents`
    Author: ${message.author.tag}
    Content: ${message.content}
    Created: ${message.createdAt.toUTCString()}
    Emoji Name: ${emoji.name}
    Reaction Count: ${count}
    ${formatCustomLogOptions(opts)}`;

  return `\n${multilineIndent(output, 2)}`;
};

const customLogger = (output: CustomLogOutput, opts?: CustomLogOptions): void => {
  const type: LogType = Object.keys(output)[0] as LogType;

  const customLogTypes = {
    interaction: LOG_TYPE_INTERACTION,
    messageReaction: LOG_TYPE_MESSAGE_REACTION,
  };

  const logType: CustomLogType = (customLogTypes as any)[type];

  if (!logType) {
    logger.warn(`Invalid log type: ${type}\nOutput: ${JSON.stringify(output)}`);
    return;
  }

  const outputData: any = (output as any)[type];
  const log = baseLogger.bind(null, logType);

  switch (logType) {
    case LOG_TYPE_INTERACTION:
      log(buildInteractionOutput(outputData, opts));
      return;
    case LOG_TYPE_MESSAGE_REACTION:
      log(buildMessageReactionOutput(outputData, opts));
      return;
  }
};

export const logger = {
  info: (message: string, ...opts: any[]): void =>
    baseLogger(LOG_TYPE_INFO, message, opts),
  warn: (message: string, ...opts: any[]): void =>
    baseLogger(LOG_TYPE_WARN, message, opts),
  error: (message: string | Error, ...opts: any[]): void =>
    baseLogger(LOG_TYPE_ERROR, message, opts),
  custom: (output: CustomLogOutput, opts?: CustomLogOptions): void =>
    customLogger(output, opts),
};
