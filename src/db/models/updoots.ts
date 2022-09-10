import knex from "../../db/db";

export interface Updoot {
  id: string;
  statementId: number;
  userId: string;
  createdAt: Date;
}

const addUpdoot = (updoot: Partial<Updoot>): Promise<any> =>
  knex("updoots")
    .insert(updoot);

const deleteUpdoot = (where: any): Promise<any> =>
  knex("updoots")
    .where(where)
    .del([ "id" ]);

export const updoots = {
  addUpdoot,
  deleteUpdoot,
};
