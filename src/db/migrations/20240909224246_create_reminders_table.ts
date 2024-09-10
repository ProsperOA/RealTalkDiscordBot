import { Knex } from "knex";

export const up = async (knex: Knex): Promise<Knex.SchemaBuilder> =>
  knex.schema.createTable("reminders", t => {
    t.increments("id");
    t.string("user_id", 18).notNullable();
    t.string("info").notNullable();
    t.string("channel_id").notNullable();
    t.dateTime("created_at").notNullable();
    t.dateTime("updated_at").notNullable();
    t.dateTime("notify_date").notNullable();
    t.index([ "user_id" ], "reminders_user_id_index");
  });

export const down = async (knex: Knex): Promise<Knex.SchemaBuilder> =>
  knex.schema.dropTable("reminders");
