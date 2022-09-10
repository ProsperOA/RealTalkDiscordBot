import { Knex } from "knex";

import knex from "../../db/db";

export interface StatementWitness {
  id: string;
  createdAt: Date;
  statementId: number;
  userId: string;
}

const getStatementWitnesses = (statementId: number): Knex.QueryBuilder<StatementWitness> =>
  knex("statementWitnesses")
    .select("userId")
    .where({ statementId });

export const statementWitnesses = {
  getStatementWitnesses,
};
