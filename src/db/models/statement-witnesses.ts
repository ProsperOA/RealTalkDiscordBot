
import { Knex } from 'knex';

import knex from '../db';

export interface StatementWitnessRecord {
  createdAt: string;
  statementId: number;
  userId: string;
}

const getStatementWitnesses = (statementId: number): Knex.QueryBuilder<StatementWitnessRecord> =>
  knex('statementWitnesses')
    .select('userId')
    .where({ statementId });

export default {
  getStatementWitnesses,
};
