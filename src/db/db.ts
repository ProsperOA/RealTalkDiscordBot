import knex from "knex";
import { camelCase, isEmpty, mapKeys, pick, snakeCase } from "lodash";

import { Config, logger } from "../utils";

const camelCaseObj = (obj: any): any => {
  const output: any = mapKeys(obj, (_, key) => camelCase(key));
  return isEmpty(output) ? obj : output;
};

export default knex({
  client: "pg",
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: Config.IsDev ? false : { rejectUnauthorized: false },
  },
  log: pick(logger, [ "error", "debug", "warn" ]),
  pool: { min: 0, max: 20 },
  postProcessResponse: result => {
    if (Array.isArray(result)) {
      return result.map(camelCaseObj);
    }

    return camelCaseObj(result);
  },
  wrapIdentifier: (value, origImpl, _) => origImpl(snakeCase(value)),
});
