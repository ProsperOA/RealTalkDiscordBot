import { Knex } from "knex";

import knex from "../../db/db";

export interface Reminder {
  id: string;
  userId: string;
  channelId: string;
  confirmationMessageId: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
  notifyOn: Date;
}

const createReminder = async (data: Partial<Reminder>): Promise<Reminder> => {
  const [id] = await knex("reminders")
    .insert({ ...data, createdAt: new Date(), updatedAt: new Date() })
    .returning("id");

  return knex("reminders")
    .where({ id })
    .first();
};

const getReminders = (limit: number = 1): Knex.QueryBuilder<Reminder> =>
  knex("reminders")
    .limit(limit);

const getReminderWhere = (where: Partial<Reminder>): Knex.QueryBuilder<Reminder> =>
  knex("reminders")
    .where(where)
    .first();

const getRemindersWhere = (where: Partial<Reminder>): Knex.QueryBuilder<Reminder[]> =>
  knex("reminders")
    .where(where);

const updateReminderWhere = (where: Partial<Reminder>, update: any): Knex.QueryBuilder<Reminder> =>
  knex("reminders")
    .where(where)
    .update({ ...update, updatedAt: new Date() });

const deleteReminder = (id: string, userId: string): Knex.QueryBuilder<Reminder> =>
  knex("reminders")
    .where({ id, userId })
    .del();

export const reminders = {
  createReminder,
  deleteReminder,
  getReminders,
  getRemindersWhere,
  getReminderWhere,
  updateReminderWhere,
};
