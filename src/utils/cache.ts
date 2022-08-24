import { cloneDeep, isEqual, isObject, mapValues } from "lodash";

import { AnyFunction, getRemainingTimeout, logger, Timeout } from "../utils";

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
  equals: (key: string, value: any) => boolean;
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
  equals: false,
  free: false,
  get: null,
  has: false,
  set: false,
  setF: false,
  take: null,
  ttl: null,
};

const validateOperation = (cacheToCheck: any, cb: AnyFunction, args: any[]): any =>
  cacheToCheck === undefined
    ? OPERATION_DEFAULT_RETURN[cb.name as keyof Cache]
    : cb(...args);

const remove = (name: string): boolean => {
  if (cacheData[name] === undefined) {
    return false;
  }

  const isDeleted: boolean = delete cacheData[name];

  if (isDeleted && ttlData[name] !== undefined) {
    delete ttlData[name];
  }

  return isDeleted;
};

const flushAll = (): number => {
  const total: number = Object.keys(cacheData).length;

  if (total) {
    cacheData = {};

    if (Object.keys(ttlData).length) {
      ttlData = {};
    }
  }

  return total;
};

const newCache = (name: string): Cache => {
  if (cacheData[name]) {
    throw new Error(`Failed to create cache. ${name} already exists`);
  }

  cacheData[name] = {};
  ttlData[name] = {};

  const operations: Record<keyof Cache, AnyFunction> = {
    clear: (): number => {
      const total: number = Object.keys(cacheData[name]).length;

      if (total) {
        cacheData[name] = {};

        if (Object.keys(ttlData[name]).length) {
          ttlData[name] = {};
        }
      }

      return total;
    },

    delete: (key: string): boolean => {
      if (!operations.has(key)) {
        return false;
      }

      const isDeleted: boolean = delete cacheData[name][key];

      if (isDeleted && ttlData[name][key] !== undefined) {
        delete ttlData[name][key];
      }

      return isDeleted;
    },

    equals: (key: string, value: any): boolean =>
      isEqual(cacheData[name][key], value),

    free: (): boolean =>
      delete cacheData[name],

    get: (key: string): any => {
      const item: any = cacheData[name][key] ?? null;
      return isObject(item) ? cloneDeep(item) : item;
    },

    has: (key: string): boolean =>
      cacheData[name][key] !== undefined,

    set: (key: string, value: any, ttl?: number): boolean => {
      if (value === undefined || operations.has(key)) {
        return false;
      }

      try {
        cacheData[name][key] = isObject(value) ? cloneDeep(value) : value;

        if (ttl > 0) {
          ttlData[name][key] = setTimeout(() => operations.delete(key), ttl) as Timeout;
        }

        return true;
      } catch (error) {
        logger.error(`stack overflow while setting ${key} in ${name}`);
        return false;
      }
    },

    setF: (key: string, value: any, ttl?: number): boolean => {
      if (value === undefined || ttl <= 0) {
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

  return mapValues(operations, fn =>
    (...args: any[]): any => validateOperation(cacheData[name], fn, args)
  );
};

export const cache = {
  flushAll,
  new: newCache,
  remove,
};
