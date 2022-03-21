import { Knex } from "knex";

export const up = async (knex: Knex): Promise<Knex.SchemaBuilder> =>
  knex.schema.alterTable("statements", t => {
    t.renameColumn("link", "url");
  });

export const down = async (knex: Knex): Promise<Knex.SchemaBuilder> =>
  knex.schema.alterTable("statements", t => {
    t.renameColumn("url", "link");
  });
