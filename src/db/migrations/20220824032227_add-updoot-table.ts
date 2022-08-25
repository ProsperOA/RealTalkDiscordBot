import { Knex } from "knex";

export const up = async (knex: Knex): Promise<Knex.SchemaBuilder> =>
  knex.schema.createTable("updoots", t => {
    t.increments("id");
    t.integer("statement_id").references("id").inTable("statements").notNullable().onDelete("CASCADE");
    t.string("user_id", 18).notNullable();
    t.dateTime("created_at").notNullable();
    t.index([ "statement_id" ], "updoots_statement_id_index");
    t.index([ "user_id" ], "updoots_user_id_index");
  });

export const down = async (knex: Knex): Promise<Knex.SchemaBuilder> =>
  knex.schema.dropTable("updoots");
