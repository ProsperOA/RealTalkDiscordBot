import { cloneDeep, isObject } from 'lodash';

import { logger } from './logger';
import { getRemainingTimeout, Timeout } from './functions';

interface CacheData {
  [name: string]: {
    [type: string]: any
  };
}

interface ExpirationTable {
  [name: string]: {
    [type: string]: Timeout;
  };
}

export interface Cache {
  del: (key: string) => void;
  get: <T = any>(key: string) => T;
  getExp: (key: string) => number | null;
  set: (key: string, value: any, expire?: number) => void;
}

const cacheData: CacheData = {};
const expirationTable: ExpirationTable = {};

const newCache = (name: string): Cache => {
  if (cacheData[name]) {
    logger.error(`${name} cache already exists`);
    process.kill(process.pid, 'SIGTERM');
  }

  cacheData[name] = {};
  expirationTable[name] = {};

  const operations = {
    del: (key: string): void => {
      if (cacheData[name][key]) {
        delete cacheData[name][key];
      }
    },
    get: <T = any>(key: string): T => {
      const item: T = cacheData[name][key];

      if (!item) {
        return null;
      }

      return isObject(item) ? cloneDeep<T>(item) : item;
    },
    getExp: (key: string): number => {
      const timeout: Timeout = expirationTable[name][key];
      return timeout ? getRemainingTimeout(timeout) : null;
    },
    set: (key: string, value: any, expire?: number): void => {
      if (expire) {
        if (expire <= 0) {
          logger.error('Cache expiration time must be greater than 0');
          process.kill(process.pid, 'SIGTERM');
        }

        expirationTable[name][key] =
          setTimeout(() => operations.del(key), expire) as Timeout;
      }

      try {
        cacheData[name][key] = isObject(value) ? cloneDeep<any>(value) : value;
      } catch (error) {
        logger.error(`StackOverflow: ${key} in ${name}`);
        process.kill(process.pid, 'SIGTERM');
      }
    },
  };

  return operations;
};

export const cache = {
  new: (name: string): Cache => newCache(name),
};
