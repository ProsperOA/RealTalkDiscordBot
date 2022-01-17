import { CacheType, CommandInteraction, CommandInteractionOption } from 'discord.js';
import { isEmpty, isString } from 'lodash';
import { stripIndents } from 'common-tags';

import { multilineIndent } from './functions';
import { SERVICE_NAME } from '../index';

export interface InteractionOptions {
  [name: string]: any;
}

type LogTypeInfo = 'info';
type LogTypeWarn = 'warn';
type LogTypeError = 'error';
type LogTypeInteraction = 'interaction';

type LogType = LogTypeInfo | LogTypeWarn | LogTypeError | LogTypeInteraction;

const LOG_TYPE_INFO: Readonly<LogTypeInfo> = 'info';
const LOG_TYPE_WARN: Readonly<LogTypeWarn> = 'warn';
const LOG_TYPE_ERROR: Readonly<LogTypeError> = 'error';
const LOG_TYPE_INTERACTION: Readonly<LogTypeInteraction> = 'interaction';

interface OutputColors {
  info: string;
  warn: string;
  error: string;
  interaction: string;
}

const OUTPUT_COLORS: Readonly<OutputColors> = {
  info: '\x1b[36m%s\x1b[0m',
  warn: '\x1b[33m%s\x1b[0m',
  error: '\x1b[31m%s\x1b[0m',
  interaction: '\x1b[35m%s\x1b[0m',
};

/**
 * Logs output to console.
 *
 * @param {LogType}        type    - type of log message.
 * @param {string | Error} message - message to log to console.
 * @param {any[]}          opts    - additional logging options.
 */
const baseLogger = (type: LogType, message: string | Error, opts?: any[]): void => {
  const baseOutput: any[] = [
    OUTPUT_COLORS[type],
    `[${SERVICE_NAME}] ${type.toUpperCase()} ${message}`
  ];

  const output: any[] = isEmpty(opts)
    ? baseOutput
    : [ ...baseOutput, ...opts ];

  const consoleLogMap = {
    info: LOG_TYPE_INFO,
    warn: LOG_TYPE_WARN,
    error: LOG_TYPE_ERROR,
    interaction: LOG_TYPE_INFO,
  };

  console[consoleLogMap[type]](...output);
};

/**
 * Formats command middleware options.
 *
 * @param   {InteractionOptions} options - List of middleware options.
 * @returns {string}
 */
const formatInteractionOptions = (options: InteractionOptions): string =>
  !isEmpty(options)
    ? Object.keys(options).map(option => isString(option)
      ? `${option}: ${options[option]}`
      : `${Object.keys(options[option]).map(key =>
          `${option}/${key}: ${[options][option][key]}`).join('\n')}`
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
      const { user } = option;
      return `${option.value} (${user.tag})`;
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
    output += `Command Option #${index + 1}:
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
 * @param   {InteractionOptions} opts        - Additional logging options.
 * @returns {string}
 */
const formatInteraction = ({ commandName, options, type }: CommandInteraction,  opts: InteractionOptions): string => {
  switch (type) {
    case 'APPLICATION_COMMAND':
      return `Command Name: ${commandName}
        ${formatInteractionOptions(opts)}

        ${formatCommandOptions(options.data)}`;
    default:
      logger.warn(`Cannot format interaction. ${type} is an invalid command interaction type.`);
      return '';
  }
};

/**
 * Builds formatted interaction message.
 *
 * @param   {CommandInteraction} interaction - Reference to interaction object.
 * @param   {InteractionOptions} opts        - Additional logging options.
 * @returns {string}
 */
const buildInteractionMessage = (interaction: CommandInteraction, opts: InteractionOptions): string => {
  const { createdAt, type, user } = interaction;

  const message: string = stripIndents`
    Type: ${type}
    Created: ${new Date(createdAt).toISOString()}
    User: ${user.tag}
    ${formatInteraction(interaction, opts)}`;

  return `\n${multilineIndent(message, 2)}`;
};

export const logger = {
  info: (message: string, ...opts: any[]): void =>
    baseLogger(LOG_TYPE_INFO, message, opts),
  warn: (message: string, ...opts: any[]): void =>
    baseLogger(LOG_TYPE_WARN, message, opts),
  error: (message: string | Error, ...opts: any[]): void =>
    baseLogger(LOG_TYPE_ERROR, message, opts),
  interaction: (interaction: CommandInteraction, opts?: InteractionOptions): void =>
    baseLogger(LOG_TYPE_INTERACTION, buildInteractionMessage(interaction, opts)),
};
