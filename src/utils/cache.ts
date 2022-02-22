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
  get: (key: string) => any;
  getExp: (key: string) => number | null;
  set: (key: string, value: any, expire?: number) => void;
}

const cacheData: CacheData = {};
const expirationTable: ExpirationTable = {};

const newCache = (name: string): Cache => {
  if (cacheData[name]) {
    throw new Error(`${name} cache already exists`);
  }

  cacheData[name] = {};
  expirationTable[name] = {};

  const operations = {
    del: (key: string): void => {
      if (cacheData[name][key]) {
        delete cacheData[name][key];
      }
    },
    get: (key: string): any => cacheData[name][key] || null,
    getExp: (key: string): number => {
      const timeout: Timeout = expirationTable[name][key];
      return timeout ? getRemainingTimeout(timeout) : null;
    },
    set: (key: string, value: any, expire?: number): void => {
      if (expire) {
        if (expire <= 0) {
          throw new Error('Cache data timeout must be greater than 0');
        }

        expirationTable[name][key] =
          setTimeout(() => operations.del(key), expire) as Timeout;
      }

      cacheData[name][key] = value;
    },
  };

  return operations;
};

export const cache = {
  new: (name: string) => newCache(name),
};
