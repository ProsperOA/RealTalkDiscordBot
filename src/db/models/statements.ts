import { Knex } from "knex";
import { head, isEmpty, merge } from "lodash";

import knex from "../../db/db";
import { StatementWitnessRecord } from "../../db/models/statement-witnesses";

export interface StatementRecord {
  accusedUserId: string;
  content: string;
  createdAt: Date;
  deletedAt: Date;
  id: number;
  isCap: boolean;
  url: string;
  userId: string;
}

export interface RealTalkStats {
  [userId: string]: {
    accusations?: number;
    uses?: number;
  };
}

export interface RealTalkStatsCompact {
  uniqueUsers: number;
  uses: number;
}

interface RealTalkAccusation {
  [accusedUserId: string]: {accusations: number};
}

interface RealTalkAccusationRecord {
  accusedUserId: string;
  count: string;
}

interface RealTalkUsage {
  [userId: string]: {uses: number};
}

interface RealTalkUsageRecord {
  count: string;
  userId: string;
}

export interface RealTalkQuizRecord {
  accusedUserId: string;
  content: string;
}

const buildWitnessRecords = (witnesses: Partial<StatementWitnessRecord>[], statementId: number, createdAt: Date): StatementWitnessRecord[] =>
  witnesses.map(witness => ({
    ...witness,
    statementId,
    createdAt,
  } as StatementWitnessRecord));

const createStatement = (statement: Partial<StatementRecord>, witnesses: Partial<StatementWitnessRecord>[]): Promise<any> =>
  knex.transaction(trx =>
    knex("statements")
      .transacting(trx)
      .insert(statement, [ "id" ])
      .then(([ data ]) => isEmpty(witnesses)
        ? data
        : knex("statementWitnesses")
          .transacting(trx)
          .insert(buildWitnessRecords(witnesses, data.id, new Date()))));

const deleteStatementWhere = (where: any): Promise<number> =>
  knex("statements")
    .where(where)
    .del<{id: number}[]>([ "id" ])
    .then(result => result[0]?.id ?? null);

const getAllStatements = (): Knex.QueryBuilder<StatementRecord[]> =>
  knex
    .select()
    .table("statements");

const getStatementWhere = (where: any): Knex.QueryBuilder =>
  knex("statements")
    .where(where)
    .first();

const transformUses = (uses: RealTalkUsageRecord[]): RealTalkUsage[] =>
  uses.map(use => ({
    [use.userId]: { uses: Number(use.count) }
  }));

const transformAccusations = (accusations: RealTalkAccusationRecord[]): RealTalkAccusation[] =>
  accusations.map(accusation => ({
    [accusation.accusedUserId]: { accusations: Number(accusation.count) }
  }));

const getStatementUses = (): Knex.QueryBuilder<RealTalkUsageRecord[]> =>
  knex("statements")
    .select("userId")
    .count("userId")
    .groupBy("userId");

const getStatementAccusations = (): Knex.QueryBuilder<RealTalkAccusationRecord[]> =>
  knex("statements")
    .select("accusedUserId")
    .count("accusedUserId")
    .groupBy("accusedUserId");

const getStatementStats = async (): Promise<RealTalkStats> => {
  const uses: RealTalkUsage[] = transformUses(await getStatementUses());
  const accusations: RealTalkAccusation[] = transformAccusations(await getStatementAccusations());

  return merge({}, ...uses, ...accusations);
};

const getRandomStatement = (where?: any): Knex.QueryBuilder<StatementRecord> =>
  knex("statements")
    .select()
    .orderByRaw("RANDOM()")
    .limit(1)
    .first()
    .modify(queryBuilder => {
      if (where) {
        queryBuilder.where(where);
      }
    });

const updateStatementWhere = (where: any, update: any): Promise<number> =>
  knex("statements")
    .where(where)
    .update<{id: number}[]>(update, [ "id" ])
    .then(result => result ? result[0].id : null);

export const statements = {
  createStatement,
  deleteStatementWhere,
  getAllStatements,
  getRandomStatement,
  getStatementStats,
  getStatementWhere,
  updateStatementWhere,
};
