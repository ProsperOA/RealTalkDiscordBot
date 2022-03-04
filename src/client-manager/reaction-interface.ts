import {
  Client,
  CommandInteraction,
  Message,
  MessageReaction,
  TextChannel,
  User,
} from 'discord.js';

import db from '../db';
import replyBuilder from './reply-builder';
import { RealTalkCommand, RealTalkSubcommand } from './commands';
import { ReactionName } from './reactions';
import { StatementRecord } from '../db/models/statements';
import { StatementWitnessRecord } from '../db/models/statement-witnesses';
import { cache, Cache, fetchFull, isDev, Time } from '../utils';
import { CommandFunction, commandInterfaceMap } from './command-interface';

export type ReactionFunction =
  (client: Client, user: User, reaction: MessageReaction) => Promise<void>;

interface ReactionInterfaceMap {
  [reaction: string]: ReactionFunction;
}

const RESPONSE_CACHE_DURATION: Readonly<number> = isDev ? 0 : Time.Hour;
const ACCEPTED_MESSAGE_TYPES: Readonly<string[]> = [ 'DEFAULT', 'REPLY' ];

const reactionResponseCache: Cache = cache.new('reactionResponseCache');

const calcCapThreshold = (max: number): number =>
  isDev ? 1 : Math.max(1, Math.floor(max * 2 / 3));

const realTalkIsCap = async (_client: Client, user: User, reaction: MessageReaction): Promise<void> => {
  const { message } = reaction;

  const fullMessage: Message = message.partial
    ? await fetchFull<Message>(message)
    : message as Message;

  if (!fullMessage) {
    await user.send(replyBuilder.internalError().content);
    return;
  }

  const { user: targetUser } = fullMessage.interaction;

  if (fullMessage.interaction?.commandName !== RealTalkCommand.RealTalk) {
    return;
  }

  const statement: StatementRecord = await db.getStatementWhere({
    user_id: targetUser.id,
    link: fullMessage.url,
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
    fullMessage.reactions.cache.filter(r => r.emoji.name === ReactionName.Cap).size;

  if (capCount >= capThreshold) {
    await db.updateStatementWhere({ id: statement.id }, { is_cap: true });
    await fullMessage.reply(replyBuilder.realTalkIsCap(statement));
  }
};

const realTalkEmojiReaction = async (client: Client, user: User, reaction: MessageReaction): Promise<void> => {
  const { message } = reaction;

  const fullMessage: Message = message.partial
    ? await fetchFull<Message>(message)
    : message as Message;

  if (!fullMessage) {
    await user.send(replyBuilder.internalError().content);
    return;
  }

  if (
    !ACCEPTED_MESSAGE_TYPES.includes(fullMessage.type) ||
    fullMessage.author.id === client.user.id
  ) {
    return;
  }

  const targetUserId: string = fullMessage.author.id;
  const messageContent: string = fullMessage.content;

  const existingStatement: StatementRecord = await db.getStatementWhere({
    accused_user_id: targetUserId,
    content: messageContent,
  });

  const channel: TextChannel = client.channels.cache.get(fullMessage.channelId) as TextChannel;

  if (existingStatement) {
    const existingRealTalk: string = replyBuilder.realTalkExists(
      user.id,
      existingStatement.link
    );

    if (existingRealTalk !== reactionResponseCache.get(user.id)) {
      await channel.send(existingRealTalk);
      reactionResponseCache.setF(user.id, existingRealTalk, RESPONSE_CACHE_DURATION);
    }

    return;
  }

  const commandParams: any = {
    what: { value: messageContent },
    who: { value: targetUserId },
  };

  const mockInteraction: any = {
    channelId: fullMessage.channelId,
    options: {
      data: [{
        name: RealTalkSubcommand.RecordBase,
        type: 'SUB_COMMAND',
      }],
      get: (name: string) => commandParams[name],
    },
    reply: (data: any) => channel.send(data),
    user,
  };

  const realTalkCommand: CommandFunction = commandInterfaceMap[RealTalkCommand.RealTalk];
  await realTalkCommand(client, mockInteraction as CommandInteraction, false);
};

export const reactionInterfaceMap: ReactionInterfaceMap = {
  [ReactionName.Cap]: realTalkIsCap,
  [ReactionName.RealTalk]: realTalkEmojiReaction,
};
