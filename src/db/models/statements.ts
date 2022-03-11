import { Knex } from 'knex';
import { isEmpty, merge } from 'lodash';

import knex from '../db';
import { StatementWitnessRecord } from './statement-witnesses';

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

const buildWitnessRecords = (witnesses: Partial<StatementWitnessRecord>[], statementId: number): StatementWitnessRecord[] =>
  witnesses.map(witness => ({
    ...witness,
    statementId,
    createdAt: new Date().toISOString(),
  } as StatementWitnessRecord));

const createStatement = (statement: Partial<StatementRecord>, witnesses: Partial<StatementWitnessRecord>[]): Promise<any> =>
  knex.transaction(trx =>
    knex('statements')
      .transacting(trx)
      .insert(statement, [ 'id' ])
      .then(data => isEmpty(witnesses)
        ? data
        : knex('statementWitnesses')
          .transacting(trx)
          .insert(buildWitnessRecords(witnesses, data[0].id))));

const getAllStatements = (): Knex.QueryBuilder<StatementRecord[]> =>
  knex
    .select()
    .table('statements');

const getStatementWhere = (where: any): Knex.QueryBuilder =>
  knex('statements')
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
  knex('statements')
    .select('userId')
    .count('userId')
    .groupBy('userId');

const getStatementAccusations = (): Knex.QueryBuilder<RealTalkAccusationRecord[]> =>
  knex('statements')
    .select('accusedUserId')
    .count('accusedUserId')
    .groupBy('accusedUserId');

const getStatementStats = async (): Promise<RealTalkStats> => {
  const uses: RealTalkUsage[] = transformUses(await getStatementUses());
  const accusations: RealTalkAccusation[] = transformAccusations(await getStatementAccusations());

  return merge({}, ...uses, ...accusations);
};

const getRandomStatement = (): Knex.QueryBuilder<StatementRecord> =>
  knex('statements')
    .select([ 'accusedUserId', 'content' ])
    .orderByRaw('RANDOM()')
    .limit(1)
    .first();

const updateStatementWhere = (where: any, update: any): Knex.QueryBuilder<any> =>
  knex('statements')
    .where(where)
    .update(update);

export default {
  createStatement,
  getAllStatements,
  getRandomStatement,
  getStatementStats,
  getStatementWhere,
  updateStatementWhere,
};
