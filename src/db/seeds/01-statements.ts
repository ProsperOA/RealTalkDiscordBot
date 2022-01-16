import { Knex } from 'knex';
import { random } from 'lodash';
import { LoremIpsum } from 'lorem-ipsum';

const randomDate = (start: Date, end: Date): Date =>
  new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

const buildStatementRecords = (userIds: string[]) => {
  const statements = [];

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

  const upperBound = userIds.length - 1;

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j <= upperBound; j++) {
      statements.push({
        user_id: userIds[random(upperBound)],
        accused_user_id: userIds[random(upperBound)],
        content: lorem.generateParagraphs(1),
        created_at: randomDate(new Date('January 1, 1970'), new Date()),
        link: 'https://discord.com',
      });
    }
  }

  return statements;
};

export async function seed(knex: Knex): Promise<void> {
  await knex('statements').del();

  const totalUsers = 30;
  const minUserId: number = 1000;
  const maxUserId: number = 9999;
  const userIds: string[] =
    Array.from({ length: totalUsers }, () => String(random(minUserId, maxUserId)));

  await knex('statements').insert(
    buildStatementRecords(userIds)
  );
}
