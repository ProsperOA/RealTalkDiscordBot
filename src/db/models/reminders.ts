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

  return await getReminderWhere({ id });
};

const getReminders = (limit: number = 30, offset: number = 0): Knex.QueryBuilder<Reminder> =>
  knex("reminders")
    .orderBy("notifyOn", "asc")
    .limit(limit)
    .offset(offset);

const getReminderWhere = (where: Partial<Reminder>): Knex.QueryBuilder<Reminder> =>
  knex("reminders")
    .where(where)
    .first();

const getRemindersWhere = (where: any, limit: number = 30, offset: number = 0): Knex.QueryBuilder<Reminder[]> =>
  knex("reminders")
    .orderBy("notifyOn", "asc")
    .limit(limit)
    .offset(offset)
    .where(where);

const updateReminderWhere = async (where: Partial<Reminder>, update: any): Promise<Reminder> => {
  const [id] = await knex("reminders")
    .where(where)
    .update({ ...update, updatedAt: new Date() })
    .returning("id");

  return await getReminderWhere({ id });
};

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
