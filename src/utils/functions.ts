export type AnyFunction = (...args: any[]) => any;

export interface Timer {
  start: () => Date;
  stop: () => Date;
  time: () => number;
}

export interface Timeout extends NodeJS.Timeout {
  _idleStart: number;
  _idleTimeout: number;
}

export enum Time {
  Second = 1000,
  Minute = Second * 60,
  Hour = Minute * 60,
  Day = Hour * 24,
}

export const getRemainingTimeout = ({ _idleStart, _idleTimeout }: Timeout): number => {
  const timeout: number = Math.ceil((_idleStart + _idleTimeout) / 1000 - process.uptime());
  return timeout >= 0 ? timeout * 1000 : 0;
};

export const multilineIndent = (str: string, indent: number = 1): string => {
  if (str.indexOf("\n") === -1) {
    return str;
  }

  const indentSize: number = indent < 1 ? 1 : indent;
  const space: string = Array.from({ length: indentSize }, () => " ").join("");

  return str
    .split("\n")
    .map(line => space + line)
    .join("\n");
};

export const pluralize = (str: string, cond: boolean | number): string =>
  cond === false || cond === 1 ? str : `${str}s`;

export const timer = (): Timer => {
  let startDate: Date = null;
  let totalTime: number = 0;

  return {
    start: (): Date => {
      startDate = new Date();
      return startDate;
    },
    stop: (): Date => {
      const endDate: Date = new Date();

      if (startDate) {
        totalTime = endDate.getTime() - startDate.getTime();
      }

      return endDate;
    },
    time: (): number => totalTime,
  };
};

export const msConvert = (ms: number, format: keyof typeof Time): number =>
  ms / Time[format];
