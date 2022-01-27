
import { Knex } from 'knex';

import knex from '../db';

export interface StatementWitnessRecord {
  created_at: string;
  statement_id: number;
  user_id: string;
}

const getStatementWitnesses = (statementId: number): Knex.QueryBuilder<StatementWitnessRecord> =>
  knex('statement_witnesses')
    .select('user_id')
    .where({ statement_id: statementId });

export default {
  getStatementWitnesses,
};
