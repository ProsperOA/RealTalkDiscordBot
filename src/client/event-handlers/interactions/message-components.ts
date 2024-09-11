import { Client, Message, MessageComponentInteraction } from "discord.js";
import { MessageComponentId } from "../../slash-commands";

import remindersScheduler from "../../reminders-scheduler";
import db from "../../../db";
import replies from "../../replies";
import { Reminder } from "../../../db/models";

const deleteReminder = async (client: Client, interaction: MessageComponentInteraction): Promise<void> => {
  const confirmationMessage: Message = interaction.message as Message;

  if (interaction.user.id !== confirmationMessage.interaction.user.id) {
    return;
  }

  const reminder: Reminder = await db.getReminderWhere({
    confirmationMessageId: confirmationMessage.id,
    userId: interaction.user.id,
  });

  if (!reminder) {
    return;
  }

  remindersScheduler.deleteReminder(reminder.id);
  await db.deleteReminder(reminder.id, reminder.userId);
  const originalMessage: Message = await interaction.channel.messages.fetch(interaction.message.id);
  await originalMessage.edit(replies.realTalkReminderDeleted());
};

export default {
  [MessageComponentId.DeleteReminder]: deleteReminder
};
