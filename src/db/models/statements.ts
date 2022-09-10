import { Knex } from "knex";
import { head, mapKeys, merge } from "lodash";

import knex from "../../db/db";
import { StatementWitness } from "../../db/models/statement-witnesses";

export interface Statement {
  accusedUserId: string;
  content: string;
  createdAt: Date;
  deletedAt: Date;
  id: number;
  isCap: boolean;
  url: string;
  userId: string;
}

export interface UpdootedStatement extends Statement {
  updoots: number;
}

export interface RealTalkStats {
  [userId: string]: {
    statements: number;
    uses: undefined;
  } | {
    statements: undefined;
    uses: number;
  } | {
    statements: number;
    uses: number;
  };
}

export interface CompactRealTalkStats {
  uniqueUsers: number;
  uses: number;
}

interface UserStatements {
  [accusedUserId: string]: {statements: number};
}

interface UserUses {
  [userId: string]: {uses: number};
}

interface AccusedUserIdTotal {
  accusedUserId: string;
  count: number;
}

interface UserIdTotal {
  userId: string;
  count: number;
}

const buildStatementWitnesses = (witnesses: Partial<StatementWitness>[], statementId: number, createdAt: Date): StatementWitness[] =>
  witnesses.map(witness => ({
    ...witness,
    statementId,
    createdAt,
  } as StatementWitness));

const createStatement = (statement: Partial<Statement>, witnesses: Partial<StatementWitness>[]): Promise<any> =>
  knex.transaction(trx =>
    knex("statements")
      .transacting(trx)
      .insert(statement, [ "id" ])
      .then(([ res ]) => witnesses
        ? knex("statementWitnesses")
          .transacting(trx)
          .insert(buildStatementWitnesses(witnesses, res.id, new Date()))
        : res));

const deleteStatementWhere = (where: any): Promise<number> =>
  knex("statements")
    .where(where)
    .del<{id: number}[]>([ "id" ])
    .then(head)
    .then(res => res?.id ?? null);

const getAllStatements = (orderBy?: any): Knex.QueryBuilder<Statement[]> =>
  knex
    .select()
    .table("statements")
    .modify(queryBuilder => {
      if (orderBy) {
        queryBuilder.orderBy(orderBy);
      }
    });

const getStatementWhere = (where: any): Knex.QueryBuilder<Statement> =>
  knex("statements")
    .where(where)
    .first();

const transformUserUses = (uses: UserIdTotal[]): UserUses[] =>
  uses.map(use => ({
    [use.userId]: { uses: use.count }
  }));

const transformUserStatements = (accusations: AccusedUserIdTotal[]): UserStatements[] =>
  accusations
    .map(accusation => ({ ...accusation, total: accusation.count }))
    .sort((a, b) => b.count - a.count)
    .map(accusation => ({ [accusation.accusedUserId]: { statements: accusation.total } }));

const getStatementUses = (): Knex.QueryBuilder<UserIdTotal[]> =>
  knex("statements")
    .select("userId")
    .count("userId")
    .groupBy("userId");

const getStatementAccusations = (): Knex.QueryBuilder<AccusedUserIdTotal[]> =>
  knex("statements")
    .select("accusedUserId")
    .count("accusedUserId")
    .groupBy("accusedUserId");

const getStatementStats = async (): Promise<RealTalkStats> => {
  const uses: UserUses[] = transformUserUses(await getStatementUses());
  const userStatements: UserStatements[] = transformUserStatements(await getStatementAccusations());

  return merge({}, ...userStatements, ...uses);
};

const getRandomStatements = (where?: any, limit: number = 1): Knex.QueryBuilder<Statement[]> =>
  knex("statements")
    .select()
    .orderByRaw("RANDOM()")
    .limit(limit)
    .modify(queryBuilder => {
      if (where) {
        queryBuilder.where(where);
      }
    });

const updateStatementWhere = (where: any, update: any): Promise<number> =>
  knex("statements")
    .where(where)
    .update<{id: number}[]>(update, [ "id" ])
    .then(head)
    .then(result => result?.id ?? null);

const getLatestStatement = (where?: any): Promise<Statement> =>
  knex("statements")
    .orderBy("created_at", "desc")
    .first()
    .modify(queryBuilder => {
      if (where) {
        queryBuilder.where(where);
      }
    });

const getTotalStatements = (): Promise<number> =>
  knex("statements")
    .count("id")
    .first()
    .then(res => res?.count as number);

const getMostUpdootedStatements = (where: any, limit: number = 5): Knex.QueryBuilder<UpdootedStatement[]> =>
  knex("statements")
    .select(knex.raw("statements.*, count(updoots.id)::int as updoots"))
    .where(mapKeys(where, (_, key) => "statements." + key))
    .limit(limit)
    .innerJoin("updoots", "statements.id", "updoots.statement_id")
    .orderBy("updoots", "desc")
    .groupBy("statements.id");

export const statements = {
  createStatement,
  deleteStatementWhere,
  getAllStatements,
  getLatestStatement,
  getMostUpdootedStatements,
  getRandomStatements,
  getStatementStats,
  getStatementWhere,
  getTotalStatements,
  updateStatementWhere,
};
