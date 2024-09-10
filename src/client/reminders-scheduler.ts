import { Client, TextChannel } from "discord.js";

import db from "../db";
import { Reminder } from "../db/models";
import { Cache, cache, nicknameMention, Time } from "../utils";

const REMINDERS_FETCH_LIMIT = 30;

// TODO: cancel timeout and remove from cache if reminder is deleted
export const remindersSchedulerCache: Cache = cache.new("timeoutCache");

const handler = (client: Client, reminder: Reminder) => async () => {
  await notify(client, reminder.id);
  remindersSchedulerCache.delete(reminder.id);
  await db.deleteReminder(reminder.id, reminder.userId);
  // add cache operations to make this more efficient
  await fillCache(client);
};

const notify = async (client: Client, reminderId: string) => {
  const reminder: Reminder = remindersSchedulerCache.get(reminderId);
  // send notification
  const channel = client.channels.cache.find(c => c.id === reminder.channelId) as TextChannel;
  await channel.send(`Reminder for ${nicknameMention(reminder.userId)}:\n${reminder.info}`);
};

const fillCache = async (client: Client, amount?: number) => {
  const reminders: Reminder[] = await db.getReminders(amount);

  reminders.forEach((reminder: Reminder) => {
    const timeout: number = new Date().getMilliseconds() - reminder.notifyDate.getMilliseconds();
    setTimeout(handler(client, reminder), timeout);

    // pad ttl to ensure notify() has sufficient runtime to complete
    remindersSchedulerCache.set(reminder.id, reminder, timeout + Time.Second);
  });

};

const run = async (client: Client) => {
  setInterval(() => fillCache(client, REMINDERS_FETCH_LIMIT), Time.Second * 10);
};

export default {
  run,
};
