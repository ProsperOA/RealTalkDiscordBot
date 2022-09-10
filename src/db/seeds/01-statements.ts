import { Knex } from "knex";
import { LoremIpsum } from "lorem-ipsum";
import { random, repeat, uniq } from "lodash";

import { Config } from "../../utils";

export interface Statement {
  accused_user_id: string;
  content: string;
  created_at: Date;
  deleted_at: Date;
  id: number;
  is_cap: boolean;
  url: string;
  user_id: string;
}

export interface StatementWitness {
  id: string;
  created_at: Date;
  statement_id: number;
  user_id: string;
}

const today: Date = new Date();
const unixEpoch: Date = new Date("January 1, 1970");

const lorem = new LoremIpsum({
  sentencesPerParagraph: {
    min: 1,
    max: 2,
  },
  wordsPerSentence: {
    min: 2,
    max: 10,
  },
});

const randomDate = (start: Date, end: Date): Date =>
  new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

const buildStatements = (userIds: string[]): Partial<Statement>[] => {
  const statements: Partial<Statement>[] = [];
  const upperBound: number = userIds.length - 1;

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j <= upperBound; j++) {
      statements.push({
        accused_user_id: userIds[random(upperBound)],
        content: lorem.generateParagraphs(1),
        created_at: randomDate(unixEpoch, today),
        url: Config.DiscordURL,
        user_id: userIds[random(upperBound)],
      });
    }
  }

  return statements;
};

const buildWitnesses = (statements: Statement[], userIds: string[]): Partial<StatementWitness>[] => {
  const witnesses: Partial<StatementWitness>[] = [];

  for (let i = 0; i < statements.length * 2 / 3; i++) {
    for (let j = 0; j < random(1, 5); j++) {
      witnesses.push({
        created_at: statements[i].created_at,
        statement_id: statements[i].id,
        user_id: userIds[random(userIds.length - 1)],
      });
    }
  }

  return witnesses;
};

export const seed = async (knex: Knex): Promise<void> => {
  await knex("statements").del();

  const totalUsers: number = 30;
  const minUserId: number = parseInt(repeat("1", 18), 10);
  const maxUserId: number = parseInt(repeat("9", 18), 10);

  const userIds: string[] = uniq(
    Array.from({ length: totalUsers }, () => String(random(minUserId, maxUserId)))
  );

  const partialStatements: Partial<Statement>[] = buildStatements(userIds);
  await knex("statements").insert(partialStatements);

  const statements: Statement[] = await knex("statements").select();
  const witnesses: Partial<StatementWitness>[] = buildWitnesses(statements, userIds);
  await knex("statement_witnesses").insert(witnesses);
};
