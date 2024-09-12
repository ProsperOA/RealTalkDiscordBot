import { Client, Message, MessagePayload, TextChannel } from "discord.js";

import db from "../db";
import replies from "./replies";
import { Reminder } from "../db/models";
import { Cache, cache, Config, logger, Time } from "../utils";

type CacheData = { reminder: Reminder, timeout: NodeJS.Timeout };

let isInitiated: boolean = false;
const FETCH_LIMIT: number = 25;
const CACHE_LIMIT: number = 50;
const FETCH_INTERVAL: number = Config.IsDev ? Time.Second * 10 : Time.Minute;

const schedulerCache: Cache = cache.new("remindersSchedulerCache");

const isCacheFull = (): boolean => schedulerCache.total() === CACHE_LIMIT;

const addReminder = async (client: Client, reminder: Reminder): Promise<void> => {
  if (isCacheFull() || schedulerCache.has(reminder.id)) {
    return;
  }

  const msUntilTrigger: number = reminder.notifyOn.getTime() - new Date().getTime();
  const timeout: NodeJS.Timeout = setTimeout(() => triggerReminder(client, reminder), msUntilTrigger);
  schedulerCache.set(reminder.id, { reminder, timeout });

  if (reminder.notifyOn < new Date()) {
    logger.warn(`Stale reminder triggered: ${reminder.id}`);
  }
};

const removeReminder = async (id: string): Promise<void> => {
  const data: CacheData = schedulerCache.get(id);

  if (data) {
    clearTimeout(data.timeout);
    schedulerCache.delete(id);
    await db.deleteReminder(id, data.reminder.userId);
  }
};

const updateConfirmationMessage = async (client: Client, reminder: Reminder, notificationUrl: string): Promise<void> => {
  const channel: TextChannel = await client.channels.fetch(reminder.channelId) as TextChannel;
  const message: Message = await channel.messages.fetch(reminder.confirmationMessageId);
  await message.edit(replies.realTalkReminderConfirmation(reminder, notificationUrl) as MessagePayload);
};

const notify = async (client: Client, reminderId: string): Promise<Message | null> => {
  const data: CacheData = schedulerCache.get(reminderId);

  if (!data) {
    return null;
  }

  const channel: TextChannel = client.channels.cache.find(c => c.id === data.reminder.channelId) as TextChannel;
  return await channel.send(replies.realTalkReminderNotification(data.reminder));
};

const triggerReminder = async (client: Client, reminder: Reminder): Promise<void> => {
  const notificationMessage: Message = await notify(client, reminder.id);

  if (!notificationMessage) {
    return;
  }

  await updateConfirmationMessage(client, reminder, notificationMessage.url);
  await removeReminder(reminder.id);
  await fillCache(client, 1);
};

const fillCache = async (client: Client, amount: number): Promise<void> => {
  if (isCacheFull()) {
    return;
  }

  const keys: string[] = schedulerCache.keys();

  const reminders: Reminder[] = keys.length
    ? await db.getRemindersWhere(`id NOT IN ${keys.map(k => `'${k}'`).join(",")}`, amount)
    : await db.getReminders(amount);

  await Promise.all(reminders.map(reminder => addReminder(client, reminder)));
};

const run = async (client: Client): Promise<void> => {
  if (isInitiated) {
    return;
  }

  isInitiated = true;
  logger.info("Reminders scheduler initiated");

  setInterval(() => fillCache(client, FETCH_LIMIT), FETCH_INTERVAL);
};

export default {
  run,
  remove: removeReminder,
  add: addReminder,
};
