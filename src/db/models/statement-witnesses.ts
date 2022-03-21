import { Knex } from "knex";

import knex from "../../db/db";

export interface StatementWitnessRecord {
  createdAt: Date;
  statementId: number;
  userId: string;
}

const getStatementWitnesses = (statementId: number): Knex.QueryBuilder<StatementWitnessRecord> =>
  knex("statementWitnesses")
    .select("userId")
    .where({ statementId });

export const statementWitnesses = {
  getStatementWitnesses,
};
