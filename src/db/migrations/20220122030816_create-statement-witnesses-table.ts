import { Knex } from "knex";

export const up = async (knex: Knex): Promise<Knex.SchemaBuilder> =>
  knex.schema.createTable("statement_witnesses", t => {
    t.increments("id");
    t.integer("statement_id").references("id").inTable("statements").notNullable().onDelete("CASCADE");
    t.string("user_id", 18).notNullable();
    t.dateTime("created_at").notNullable();
    t.index([ "id", "statement_id" ], "statement_witnesses_statement_id_index");
    t.index([ "user_id" ], "statement_witnesses_user_id_index");
  });

export const down = async (knex: Knex): Promise<Knex.SchemaBuilder> =>
  knex.schema.dropTable("statement_witnesses");
