import { config } from 'dotenv';

config({ debug: true });

const { DATABASE_URL }: NodeJS.ProcessEnv = process.env;

export default {
  development: {
    client: 'pg',
    connection: {
      connectionString: DATABASE_URL,
      ssl: false,
    },
    migrations: {
      directory: 'db/migrations',
    },
    seeds: {
      directory: 'db/seeds',
    },
  },
  production: {
    client: 'pg',
    connection: {
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    },
    pool: {
      min: 0,
      max: 20,
    },
    migrations: {
      directory: 'db/migrations',
    },
  },
};
