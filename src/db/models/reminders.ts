import { Knex } from "knex";

import knex from "../../db/db";

export interface Reminder {
  id: string;
  userId: string;
  info: string;
  channelId: string;
  createdAt: Date;
  updatedAt: Date;
  notifyDate: Date;
}

export interface ReminderData {
  userId: string;
  info: string;
  notifyDate: Date;
  channelId: string;
}

const createReminder = (data: ReminderData): Knex.QueryBuilder<Reminder> =>
  knex("reminders")
    .insert({ ...data, createdAt: new Date(), updatedAt: new Date() });

const getReminders = (limit: number = 1): Knex.QueryBuilder<Reminder> =>
  knex("reminders")
    .limit(limit);

const deleteReminder = (id: string, userId: string): Knex.QueryBuilder<Reminder> =>
  knex("reminders")
    .where({ id, userId })
    .del();

export const reminders = {
  createReminder,
  deleteReminder,
  getReminders,
};
