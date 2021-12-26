import { config } from 'dotenv';

const { error } = config({ debug: true });

if (error) {
  throw error;
}
