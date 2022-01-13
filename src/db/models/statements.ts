import { merge } from 'lodash';

import knex from '../db';

export interface StatementRecord {
  user_id: string;
  accused_user_id: string;
  created_at: Date;
  deleted_at?: Date;
  content: string;
  link: string;
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

const createStatement = (data: StatementRecord) =>
  knex('statements')
    .insert(data);

const getAllStatements = () =>
  knex
    .select()
    .table('statements');

const transformUses = (uses: RealTalkUsageRecord[]): RealTalkUsage[] =>
  uses.map(use => ({
    [use.user_id]: { uses: Number(use.count) }
  }));

const transformAccusations = (accusations: RealTalkAccusationRecord[]): RealTalkAccusation[] =>
  accusations.map(accusation => ({
    [accusation.accused_user_id]: { accusations: Number(accusation.count) }
  }));

const getStatementUses = () =>
  knex('statements')
    .select('user_id')
    .count('user_id')
    .groupBy('user_id');

const getStatementAccusations = () =>
  knex('statements')
    .select('accused_user_id')
    .count('accused_user_id')
    .groupBy('accused_user_id');

const getStatementStats = async (): Promise<RealTalkStats> => {
  const uses: RealTalkUsage[] = transformUses(await getStatementUses());
  const accusations: RealTalkAccusation[] = transformAccusations(await getStatementAccusations());

  return merge({}, ...uses, ...accusations);
};

const getRandomStatement = () =>
  knex('statements')
    .select([ 'accused_user_id', 'content' ])
    .orderByRaw('RANDOM()')
    .limit(1)
    .first();

export default {
  createStatement,
  getAllStatements,
  getRandomStatement,
  getStatementStats,
};
