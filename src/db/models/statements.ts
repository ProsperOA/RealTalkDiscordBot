import knex from '../db';

export interface StatementRecord {
  user_id: string;
  accused_user_id: string;
  created_at: Date;
  deleted_at?: Date;
  content: string;
  link: string;
}

const createStatement = (data: StatementRecord) =>
  knex('statements').insert(data);

const getAllStatements = () =>
  knex.select().table('statements');

export default {
  createStatement,
  getAllStatements,
};
