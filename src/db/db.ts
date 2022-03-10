import knex from 'knex';

import { Config } from '../utils';

export default knex({
  client: 'pg',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: Config.IsDev ? false : { rejectUnauthorized: false },
  },
  pool: { min: 0, max: 20 }
});
