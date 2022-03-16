import { Message } from 'discord.js';

import db from '../../db';
import { RealTalkCommand } from '../commands/slash-commands';
import { buildMessageUrl } from '../../utils';

const onMessageDelete = async (message: Message): Promise<Date> => {
  const { interaction } = message;

  if (interaction?.commandName !== RealTalkCommand.RealTalk) {
    return null;
  }

  const { user } = interaction;
  const deletedAt: Date = new Date();

  const result: number = await db.updateStatementWhere(
    { userId: user.id, url: buildMessageUrl(message) },
    { deletedAt },
  );

  return result ? deletedAt : null;
};

export default {
  onMessageDelete,
};
