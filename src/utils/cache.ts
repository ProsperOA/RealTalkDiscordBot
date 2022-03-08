import { cloneDeep, isObject } from 'lodash';

import { logger } from './logger';
import { AnyFunction, getRemainingTimeout, Timeout } from './functions';

interface CacheData {
  [name: string]: {
    [type: string]: any
  };
}

interface TTLData {
  [name: string]: {
    [type: string]: Timeout;
  };
}

export interface Cache {
  clear: () => number;
  delete: (key: string) => boolean;
  free: () => boolean;
  get: (key: string) => any;
  has: (key: string) => boolean;
  set: (key: string, value: any, ttl?: number) => boolean;
  setF: (key: string, value: any, ttl?: number) => boolean;
  take: (key: string) => any;
  ttl: (key: string) => number;
}

let cacheData: CacheData = {};
let ttlData: TTLData = {};

const OPERATION_DEFAULT_RETURN: Readonly<Record<keyof Cache, number | boolean>> = {
  clear: 0,
  delete: false,
  free: false,
  get: null,
  has: false,
  set: false,
  setF: false,
  take: null,
  ttl: null,
};

const preCheck = (canOperate: boolean, callback: AnyFunction, args: any[]): any => {
  if (!canOperate) {
    return OPERATION_DEFAULT_RETURN[callback.name as keyof Cache];
  }

  return callback(...args);
};

const removeCache = (name: string): boolean => {
  if (cacheData[name] === undefined) {
    return false;
  }

  delete cacheData[name];

  if (ttlData[name] !== undefined) {
    delete ttlData[name];
  }

  return true;
};

const removeAll = (): number => {
  const cacheTotal: number = Object.keys(cacheData).length;

  if (!cacheTotal) {
    return cacheTotal;
  }

  cacheData = {};

  if (Object.keys(ttlData).length) {
    ttlData = {};
  }

  return cacheTotal;
};

const newCache = (name: string): Cache => {
  if (cacheData[name]) {
    logger.error(`${name} cache already exists`);
    process.kill(process.pid, 'SIGTERM');
  }

  cacheData[name] = {};
  ttlData[name] = {};

  const operations: Record<keyof Cache, AnyFunction> = {
    clear: (): number => {
      const cacheDataTotal: number = Object.keys(cacheData[name]).length;

      if (!cacheDataTotal) {
        return cacheDataTotal;
      }

      cacheData[name] = {};

      if (Object.keys(ttlData[name]).length) {
        ttlData[name] = {};
      }

      return cacheDataTotal;
    },
    delete: (key: string): boolean => {
      if (!operations.has(key)) {
        return false;
      }

      delete cacheData[name][key];

      if (operations.ttl(key)) {
        delete ttlData[name][key];
      }

      return true;
    },
    free: (): boolean => {
      delete cacheData[name];
      return true;
    },
    get: (key: string): any => {
      const item: any = cacheData[name][key] ?? null;
      return isObject(item) ? cloneDeep(item) : item;
    },
    has: (key: string): boolean => cacheData[name][key] !== undefined,
    set: (key: string, value: any, ttl?: number): boolean => {
      if (value === undefined || operations.has(key)) {
        return false;
      }

      if (ttl) {
        if (ttl < 0) {
          return false;
        }

        ttlData[name][key] = setTimeout(() => operations.delete(key), ttl) as Timeout;
      }

      try {
        cacheData[name][key] = isObject(value) ? cloneDeep(value) : value;
        return true;
      } catch (error) {
        logger.error(`stack overflow while setting ${key} in ${name}`);
        return false;
      }
    },
    setF: (key: string, value: any, ttl?: number): boolean => {
      if (value === undefined || (ttl && ttl <= 0)) {
        return false;
      }

      operations.delete(key);

      return operations.set(key, value, ttl);
    },
    take: (key: string): any => {
      if (!operations.has(key)) {
        return null;
      }

      const item: any = operations.get(key);
      operations.delete(key);

      return item;
    },
    ttl: (key: string): number => {
      const timeout: Timeout = ttlData[name][key];
      return timeout ? getRemainingTimeout(timeout) : null;
    },
  };

  Object.values(operations).map(fn =>
    (...args: any[]): any => preCheck(cacheData[name] !== undefined, fn, args)
  );

  return operations;
};

export const cache = {
  remove: removeCache,
  remoteAll: removeAll,
  new: newCache,
};
