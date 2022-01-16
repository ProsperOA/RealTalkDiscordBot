import { Knex } from 'knex';

export const up = async (knex: Knex): Promise<Knex.SchemaBuilder> =>
  knex.schema.createTable('statements', t => {
    t.increments('id');
    t.string('user_id', 18).notNullable();
    t.string('accused_user_id', 18).notNullable();
    t.dateTime('created_at').notNullable();
    t.dateTime('deleted_at').nullable();
    t.string('content').notNullable();
    t.string('link').notNullable();
    t.index([ 'user_id', 'accused_user_id' ], 'statements_user_id_index');
  });

export const down = async (knex: Knex): Promise<Knex.SchemaBuilder> =>
  knex.schema.dropTable('statements');
