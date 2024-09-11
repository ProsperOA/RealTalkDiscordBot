import { Client, Message, TextChannel } from "discord.js";

import db from "../db";
import { Reminder } from "../db/models";
import { Cache, cache, nicknameMention, Time } from "../utils";
import replies from "./replies";

const REMINDERS_FETCH_LIMIT = 30;
let initiated: boolean = false;

// TODO: cancel timeout and remove from cache if reminder is deleted
const remindersSchedulerCache: Cache = cache.new("timeoutCache");

const deleteReminder = (id: string): void => {
  remindersSchedulerCache.delete(id);
};

const handler = async (client: Client, reminder: Reminder): Promise<void> => {
  await notify(client, reminder.id);

  const channel: TextChannel = await client.channels.fetch(reminder.channelId) as TextChannel;
  const message: Message = await channel.messages.fetch(reminder.notificationId);
  await message.edit(replies.realTalkReminderSent());

  remindersSchedulerCache.delete(reminder.id);
  await db.deleteReminder(reminder.id, reminder.userId);

  await fillCache(client);
};

const notify = async (client: Client, reminderId: string): Promise<void> => {
  const reminder: Reminder = remindersSchedulerCache.get(reminderId);
  const channel = client.channels.cache.find(c => c.id === reminder.channelId) as TextChannel;
  await channel.send(`Reminder for ${nicknameMention(reminder.userId)}:\n${reminder.message}`);
};

const fillCache = async (client: Client, amount?: number) => {
  const reminders: Reminder[] = await db.getReminders(amount);

  for (const reminder of reminders) {
    if (remindersSchedulerCache.has(reminder.id)) {
      continue;
    }

    const timeout: number = reminder.notifyOn.getTime() - new Date().getTime();
    setTimeout(() => handler(client, reminder), timeout);
    remindersSchedulerCache.set(reminder.id, reminder, timeout);
  }

};

const run = async (client: Client): Promise<void> => {
  if (initiated) {
    return;
  }

  initiated = true;
  // i don't like this, but it's cheaper than jobs
  setInterval(() => fillCache(client, REMINDERS_FETCH_LIMIT), Time.Second * 10);
};

export default {
  run,
  deleteReminder,
};
