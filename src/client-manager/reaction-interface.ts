import { Client, MessageReaction } from 'discord.js';

import db from '../db';
import replyBuilder from './reply-builder';
import { COMMAND_REAL_TALK } from './commands';
import { REACTION_REAL_TALK_CAP } from './reactions';
import { StatementRecord } from '../db/models/statements';
import { StatementWitnessRecord } from '../db/models/statement-witnesses';
import { isDev } from '../utils';

export type ReactionFunction =
  (client: Client, reaction: MessageReaction) => Promise<void>;

interface ReactionInterfaceMap {
  [reaction: string]: ReactionFunction;
}

const calcCapThreshold = (max: number): number =>
  isDev ? 1 : Math.max(1, Math.floor(max * 2 / 3));

const realTalkIsCap = async (_client: Client, reaction: MessageReaction): Promise<void> => {
  const { message } = reaction;
  const { user } = message.interaction;

  if (message.interaction.commandName !== COMMAND_REAL_TALK) {
    return;
  }

  const statement: StatementRecord = await db.getStatementWhere({
    user_id: user.id,
    link: message.url,
  });

  if (statement.is_cap) {
    await reaction.remove();
    return;
  }

  const witnesses: StatementWitnessRecord[] = await db.getStatementWitnesses(statement.id);

  if (!isDev) {
    const isWitness: boolean = Boolean(witnesses.find(witness => witness.user_id === user.id));
    const isAuthor: boolean = user.id === statement.user_id;

    if (isAuthor || !isWitness) {
      await reaction.remove();
      return;
    }
  }

  const capThreshold: number = calcCapThreshold(witnesses.length);
  const capCount: number =
    message.reactions.cache.filter(r => r.emoji.name === REACTION_REAL_TALK_CAP).size;

  if (capCount >= capThreshold) {
    await db.updateStatementWhere({ id: statement.id }, { is_cap: true });
    await message.reply(replyBuilder.realTalkIsCap(statement));
  }
};

export const reactionInterfaceMap: ReactionInterfaceMap = {
  [REACTION_REAL_TALK_CAP]: realTalkIsCap,
};
