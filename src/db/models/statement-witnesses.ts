
import knex from '../db';

export interface StatementWitnessRecord {
  created_at: string;
  statement_id: number;
  user_id: string;
}

const getStatementWitnesses = (statementId: string) =>
  knex('statement_witnesses')
    .select('user_id')
    .where({ statement_id: statementId });

export default {
  getStatementWitnesses,
};
