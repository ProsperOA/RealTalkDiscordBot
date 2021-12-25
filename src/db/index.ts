import { knex } from 'knex';
import { camelCase } from 'lodash';

export default knex({
  client: 'pg',
  connection: {
    connectString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  },
  pool: { min: 0, max: 20 },
  postProcessResponse: result =>
    Array.isArray(result) ? result.map(camelCase) : camelCase(result),
});
