import { Knex } from 'knex';
import { isEmpty, merge } from 'lodash';

import knex from '../db';
import { StatementWitnessRecord } from './statement-witnesses';

export interface StatementRecord {
  id?: number;
  user_id: string;
  accused_user_id: string;
  created_at: Date;
  deleted_at?: Date;
  content: string;
  link: string;
  is_cap?: boolean;
}

export interface RealTalkStats {
  [userId: string]: {
    uses?: number;
    accusations?: number;
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
  accused_user_id: string;
  count: string;
}

interface RealTalkUsage {
  [userId: string]: {uses: number};
}

interface RealTalkUsageRecord {
  user_id: string;
  count: string;
}

export interface RealTalkQuizRecord {
  accused_user_id: string;
  content: string;
}

const buildWitnessRecords = (witnesses: Partial<StatementWitnessRecord>[], statementId: number): StatementWitnessRecord[] =>
  witnesses.map(witness => ({
    ...witness,
    statement_id: statementId,
    created_at: new Date().toISOString(),
  } as StatementWitnessRecord));

const createStatement = (statement: StatementRecord, witnesses: Partial<StatementWitnessRecord>[]): Promise<any> =>
  knex.transaction(trx =>
    knex('statements')
      .transacting(trx)
      .insert(statement, [ 'id' ])
      .then(data => isEmpty(witnesses)
        ? data
        : knex('statement_witnesses')
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
    [use.user_id]: { uses: Number(use.count) }
  }));

const transformAccusations = (accusations: RealTalkAccusationRecord[]): RealTalkAccusation[] =>
  accusations.map(accusation => ({
    [accusation.accused_user_id]: { accusations: Number(accusation.count) }
  }));

const getStatementUses = (): Knex.QueryBuilder<RealTalkUsageRecord[]> =>
  knex('statements')
    .select('user_id')
    .count('user_id')
    .groupBy('user_id');

const getStatementAccusations = (): Knex.QueryBuilder<RealTalkAccusationRecord[]> =>
  knex('statements')
    .select('accused_user_id')
    .count('accused_user_id')
    .groupBy('accused_user_id');

const getStatementStats = async (): Promise<RealTalkStats> => {
  const uses: RealTalkUsage[] = transformUses(await getStatementUses());
  const accusations: RealTalkAccusation[] = transformAccusations(await getStatementAccusations());

  return merge({}, ...uses, ...accusations);
};

const getRandomStatement = (): Knex.QueryBuilder<StatementRecord> =>
  knex('statements')
    .select([ 'accused_user_id', 'content' ])
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
