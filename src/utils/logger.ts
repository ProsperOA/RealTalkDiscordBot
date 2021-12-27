import { CacheType, CommandInteraction, CommandInteractionOption } from 'discord.js';
import { isEmpty } from 'lodash';

import { config } from '../constants';

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
const baseLogger = (
  type: LogType,
  message: string | Error,
  opts?: any[]
): void => {
  const output: any[] = [
    OUTPUT_COLORS[type],
    `[${config.serviceName}] ${type.toUpperCase()} ${message}`
  ];

  if (!isEmpty(opts)) {
    output.push(...opts);
  }

  const consoleLogType = {
    info: LOG_TYPE_INFO,
    warn: LOG_TYPE_WARN,
    error: LOG_TYPE_ERROR,
    interaction: LOG_TYPE_INFO,
  };

  (console as any)[consoleLogType.interaction](...output);
};


/**
 * Formats application command options.
 *
 * @param {Readonly<CommandInteraction<CacheType>[]} interaction - List of interaction options.
 * @returns {string}
 */
const formatApplicationCommandOptions = (
  options: Readonly<CommandInteractionOption<CacheType>[]>
): string =>
  options.map(({ name, type, value }, index) => (`
    Command Option #${index + 1}:
      Name: ${name}
      Type: ${type}
      Value: ${value}`
    )).join('\n');

/**
 * Formats a portion of the interaction message based on interaction type.
 *
 * @param {CommandInteraction} interaction - Reference to interaction object.
 * @returns {string}
 */
const formatInteraction = (
  { commandName, options, type }: CommandInteraction
): string => {
  switch (type) {
    case 'APPLICATION_COMMAND':
      return (`Command Name: ${commandName}
        ${formatApplicationCommandOptions(options.data)}
      `);
    default:
      logger.warn('Cannot format interaction. Invalid command interaction type.');
      return '';
  }
};

/**
 * Builds formatted interaction message.
 *
 * @param {CommandInteraction} interaction - Reference to interaction object.
 * @returns {string}
 */
const buildInteractionMessage = (interaction: CommandInteraction): string => {
  const { createdAt, type, user } = interaction;

  return (`
    Type: ${type}
    Created: ${new Date(createdAt).toISOString()}
    User: ${user.tag}
    ${formatInteraction(interaction)}
  `);
};

export const logger = {
  info: (message: string, ...opts: any[]) =>
    baseLogger(LOG_TYPE_INFO, message, opts),
  warn: (message: string, ...opts: any[]) =>
    baseLogger(LOG_TYPE_WARN, message, opts),
  error: (message: string | Error, ...opts: any[]) =>
    baseLogger(LOG_TYPE_ERROR, message, opts),
  interaction: (interaction: CommandInteraction) =>
    baseLogger(LOG_TYPE_INTERACTION, buildInteractionMessage(interaction)),
};
