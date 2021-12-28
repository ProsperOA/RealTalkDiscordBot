import { Knex } from 'knex';

export const up = async (knex: Knex): Promise<void> =>
  knex.schema.createTable('statements', t => {
    t.uuid('id').primary();
    t.string('user_id', 18).notNullable();
    t.string('accused_user_id', 18).notNullable();
    t.dateTime('created_at').notNullable();
    t.dateTime('deleted_at').nullable();
    t.string('content').notNullable();
    t.string('link').notNullable();
  });

export const down = async (knex: Knex): Promise<void> =>
  knex.schema.dropTable('statements');
