import { config } from 'dotenv';
config({ debug: true });

const { DATABASE_URL } = process.env;

export default {
  development: {
    client: 'pg',
    connection: {
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    },
    migrations: {
      directory: './src/db/migrations',
    },
    seeds: {
      directory: './src/db/seeds',
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
      directory: './src/db/migrations',
    },
  },
};
