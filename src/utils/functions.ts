import { Canvas, SKRSContext2D } from "@napi-rs/canvas";

export type AnyFunction = (...args: any[]) => any;
export type AnyPromiseFunction = (...args: any[]) => Promise<any>;

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
  return Math.max(0, timeout * 1000);
};

export const indent = (str: string, length: number = 1, char: string = " "): string => {
  const indentSize: number = Math.max(1, length);
  const padding: string = Array.from({ length: indentSize }, () => char).join("");

  if (str.indexOf("\n") === -1) {
    return padding + str;
  }

  return str
    .split("\n")
    .map(line => padding + line)
    .join("\n");
};

export const pluralize = (str: string, cond: boolean | number): string =>
  cond === false || cond === 1 ? str : str + "s";

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
    time: (): number =>
      totalTime,
  };
};

export const msConvert = (ms: number, format: keyof typeof Time): number =>
  ms / Time[format];

// source: https://stackoverflow.com/a/16599668
export const wrapCanvasText = (canvas: Canvas, text: string, maxWidth: number): string[] => {
  const context: SKRSContext2D = canvas.getContext("2d");

  const words: string[] = text.split(" ");
  const lines: string[] = [];
  let currentLine: string = words[0];

  for (let i = 1; i < words.length; i++) {
    const word: string = words[i];
    const { width }: TextMetrics = context.measureText(`${currentLine} ${word}`);

    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  lines.push(currentLine);
  return lines;
};

export const sleep = async (time: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, Math.max(0, time)));

export const delay = async (time: number, cb: AnyFunction): Promise<any> => {
  await sleep(time);
  return cb();
};

export const delayP = async (time: number, cb: AnyPromiseFunction): Promise<any> => {
  await sleep(time);
  return await cb();
};

export const delayObjAction = async <T>(time: number, obj: T, key: keyof T): Promise<any> => {
  await sleep(time);
  return (obj as any)?.[key]?.();
};

export const delayObjActionP = async <T>(time: number, obj: T, key: keyof T): Promise<any> => {
  await sleep(time);
  return await (obj as any)?.[key]?.();
};
