import { Knex } from "knex";

import knex from "../../db/db";

export interface Reminder {
  id: string;
  userId: string;
  message: string;
  channelId: string;
  createdAt: Date;
  updatedAt: Date;
  notifyOn: Date;
}

const createReminder = (data: Partial<Reminder>): Knex.QueryBuilder<Reminder> =>
  knex("reminders")
    .insert({ ...data, createdAt: new Date(), updatedAt: new Date() });

const getReminders = (limit: number = 1): Knex.QueryBuilder<Reminder> =>
  knex("reminders")
    .limit(limit);

const getRemindersWhere = (where: Partial<Reminder>): Knex.QueryBuilder<Reminder> =>
  knex("reminders")
    .where(where);

const deleteReminder = (id: string, userId: string): Knex.QueryBuilder<Reminder> =>
  knex("reminders")
    .where({ id, userId })
    .del();

export const reminders = {
  createReminder,
  deleteReminder,
  getReminders,
  getRemindersWhere,
};
