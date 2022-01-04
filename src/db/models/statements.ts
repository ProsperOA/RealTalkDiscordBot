import knex from '../db';

export interface StatementRecord {
  user_id: string;
  accused_user_id: string;
  created_at: Date;
  content: string;
  link: string;
}

const table = knex('statements');

const createStatement = (data: StatementRecord) =>
  table.insert(data);

export default {
  createStatement,
};
