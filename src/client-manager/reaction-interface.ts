import { Client, CommandInteraction, MessageReaction, TextChannel, User } from 'discord.js';

import db from '../db';
import replyBuilder from './reply-builder';
import { COMMAND_REAL_TALK, SUBCOMMAND_REAL_TALK_RECORD_BASE } from './commands';
import { REACTION_REAL_TALK_CAP, REACTION_REAL_TALK_EMOJI } from './reactions';
import { StatementRecord } from '../db/models/statements';
import { StatementWitnessRecord } from '../db/models/statement-witnesses';
import { cache, Cache, isDev } from '../utils';
import { CommandFunction, commandInterfaceMap } from './command-interface';

export type ReactionFunction =
  (client: Client, user: User, reaction: MessageReaction) => Promise<void>;

interface ReactionInterfaceMap {
  [reaction: string]: ReactionFunction;
}

const RESPONSE_CACHE_DURATION: Readonly<number> = isDev ? 0 : 1000 * 60 * 60;
const ACCEPTED_MESSAGE_TYPES: Readonly<string[]> = [ 'DEFAULT', 'REPLY' ];

const reactionResponseCache: Cache = cache.new('reactionResponseCache');

const calcCapThreshold = (max: number): number =>
  isDev ? 1 : Math.max(1, Math.floor(max * 2 / 3));

const realTalkIsCap = async (_client: Client, _user: User, reaction: MessageReaction): Promise<void> => {
  const { message } = reaction;
  const { user } = message.interaction;

  if (message.interaction?.commandName !== COMMAND_REAL_TALK) {
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

const realTalkEmojiReaction = async (client: Client, user: User, reaction: MessageReaction): Promise<void> => {
  const { message } = reaction;

  if (
    !ACCEPTED_MESSAGE_TYPES.includes(message.type) ||
    message.author.id === client.user.id
  ) {
    return;
  }

  const targetUserId: string = message.author.id;
  const messageContent: string = message.content;

  const existingStatement: StatementRecord = await db.getStatementWhere({
    accused_user_id: targetUserId,
    content: messageContent,
  });

  const channel: TextChannel = client.channels.cache.get(message.channelId) as TextChannel;

  if (existingStatement) {
    const existingRealTalk: string = replyBuilder.realTalkExists(
      user.id,
      existingStatement.link
    );

    if (existingRealTalk !== reactionResponseCache.get(user.id)) {
      await channel.send(existingRealTalk);
      reactionResponseCache.set(user.id, existingRealTalk, RESPONSE_CACHE_DURATION);
    }

    return;
  }

  const commandParams: any = {
    what: { value: messageContent },
    who: { value: targetUserId },
  };

  const mockInteraction: any = {
    channelId: message.channelId,
    options: {
      data: [{
        name: SUBCOMMAND_REAL_TALK_RECORD_BASE,
        type: 'SUB_COMMAND',
      }],
      get: (param: string) => commandParams[param],
    },
    reply: (data: any) => channel.send(data),
    user,
  };

  const realTalkCommand: CommandFunction = commandInterfaceMap[COMMAND_REAL_TALK];
  await realTalkCommand(client, mockInteraction as CommandInteraction, false);
};

export const reactionInterfaceMap: ReactionInterfaceMap = {
  [REACTION_REAL_TALK_CAP]: realTalkIsCap,
  [REACTION_REAL_TALK_EMOJI]: realTalkEmojiReaction,
};
