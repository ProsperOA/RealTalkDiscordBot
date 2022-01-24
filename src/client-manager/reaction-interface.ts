import { Client, MessageInteraction, MessageReaction, PartialMessageReaction } from 'discord.js';

import db from '../db';
import replyBuilder from './reply-builder';
import { StatementRecord } from '../db/models/statements';
import { COMMAND_REAL_TALK } from './commands';
import { REACTION_REAL_TALK_CAP } from './reactions';

type ReactionFunction = (client: Client, reaction: MessageReaction | PartialMessageReaction) => void;

interface ReactionInterfaceMap {
  [reaction: string]: ReactionFunction;
}

const CAP_THRESHOLD: Readonly<number> = 5;

const realTalkIsCap = async (_client: Client, reaction: MessageReaction | PartialMessageReaction): Promise<void> => {
  const interaction: MessageInteraction = reaction.message.interaction;

  if (interaction.commandName !== COMMAND_REAL_TALK || reaction.count < CAP_THRESHOLD) {
    return;
  }

  const statement: StatementRecord = await db.getStatementWhere({
    user_id: interaction.user.id,
    link: reaction.message.url,
  });

  if (statement.is_cap) {
    return;
  }

  await db.updateStatementWhere({ id: statement.id }, { is_cap: true });
  await reaction.message.reply(replyBuilder.realTalkIsCap(statement));
};

export const reactionInterfaceMap: ReactionInterfaceMap = {
  [REACTION_REAL_TALK_CAP]: realTalkIsCap,
};