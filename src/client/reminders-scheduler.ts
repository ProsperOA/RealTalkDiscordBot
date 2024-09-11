import { Client, Message, TextChannel } from "discord.js";

import db from "../db";
import replies from "./replies";
import { Reminder } from "../db/models";
import { Cache, cache, Config, Time } from "../utils";

let initiated: boolean = false;
const INITIAL_FETCH_LIMIT: number = 30;
const FETCH_INTERVAL: number = Config.IsDev ? Time.Second * 10 : Time.Minute;

const remindersSchedulerCache: Cache = cache.new("timeoutCache");

const deleteReminder = (id: string): void => {
  const result = remindersSchedulerCache.get(id);

  if (result) {
    clearTimeout(result.timeout);
    remindersSchedulerCache.delete(id);
  }
};

const handler = async (client: Client, reminder: Reminder): Promise<void> => {
  await notify(client, reminder.id);

  const channel: TextChannel = await client.channels.fetch(reminder.channelId) as TextChannel;
  const message: Message = await channel.messages.fetch(reminder.confirmationMessageId);
  await message.edit(replies.realTalkReminderSent());

  remindersSchedulerCache.delete(reminder.id);
  await db.deleteReminder(reminder.id, reminder.userId);

  await fillCache(client);
};

const notify = async (client: Client, reminderId: string): Promise<void> => {
  const { reminder } = remindersSchedulerCache.get(reminderId);
  const channel = client.channels.cache.find(c => c.id === reminder.channelId) as TextChannel;
  await channel.send(replies.realTalkReminderNotification(reminder))
};

const fillCache = async (client: Client, amount?: number) => {
  const reminders: Reminder[] = (await db.getReminders(amount))
    .filter((reminder: Reminder) => !remindersSchedulerCache.has(reminder.id));

  for (const reminder of reminders) {
    const ttl: number = reminder.notifyOn.getTime() - new Date().getTime();
    const timeout: NodeJS.Timeout = setTimeout(() => handler(client, reminder), ttl);
    remindersSchedulerCache.set(reminder.id, { reminder, timeout }, ttl);
  }
};

const run = async (client: Client): Promise<void> => {
  if (initiated) {
    return;
  }

  initiated = true;
  // i don't like this, but it's cheaper than jobs
  setInterval(() => fillCache(client, INITIAL_FETCH_LIMIT), FETCH_INTERVAL);
};

export default {
  run,
  deleteReminder,
};
