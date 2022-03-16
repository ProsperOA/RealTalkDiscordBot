import { Client, Message } from 'discord.js';

import db from '../db';
import { RealTalkCommand } from './commands';
import { buildMessageUrl } from '../utils';

const onMessageDelete = async (_client: Client, message: Message): Promise<void> => {
  const { interaction } = message;

  if (interaction?.commandName !== RealTalkCommand.RealTalk) {
    return;
  }

  await db.updateStatementWhere(
    { userId: interaction.user.id, url: buildMessageUrl(message) },
    { deletedAt: new Date() },
  );
};

export default {
  onMessageDelete,
};
