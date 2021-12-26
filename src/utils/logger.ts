import { isEmpty } from 'lodash';

type LogTypeInfo = 'info';
type LogTypeWarn = 'warn';
type LogTypeError = 'error';

type LogType = LogTypeInfo | LogTypeWarn | LogTypeError;

const LOG_TYPE_INFO: Readonly<LogTypeInfo> = 'info';
const LOG_TYPE_WARN: Readonly<LogTypeWarn> = 'warn';
const LOG_TYPE_ERROR: Readonly<LogTypeError> = 'error';

interface OutputColors {
  info: string;
  warn: string;
  error: string;
}

const OUTPUT_COLORS: Readonly<OutputColors> = {
  info: '\x1b[36m%s\x1b[0m',
  warn: '\x1b[33m%s\x1b[0m',
  error: '\x1b[31m%s\x1b[0m',
};

/**
 * Logs output to console.
 *
 * @param   {LogType}        type    - type of log message.
 * @param   {string | Error} message - message to log to console.
 * @param   {any[]}          opts    - additional logging options.
 */
const baseLogger = (
  type: LogType,
  message: string | Error,
  opts: any[]
): void => {
  const log = (console as any)[type];
  const time: string = new Date().toISOString().split('T')[1];

  const output: any[] = [
    OUTPUT_COLORS[type],
    `[${time}] ${type.toUpperCase()} ${message}`
  ];

  if (!isEmpty(opts)) {
    output.push(...opts);
  }

  log(...output);
};

export const logger = {
  info: (message: string, ...opts: any[]) =>
    baseLogger(LOG_TYPE_INFO, message, opts),
  warn: (message: string, ...opts: any[]) =>
    baseLogger(LOG_TYPE_WARN, message, opts),
  error: (message: string | Error, ...opts: any[]) =>
    baseLogger(LOG_TYPE_ERROR, message, opts),
};
