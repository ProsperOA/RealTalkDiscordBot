import {
  Client,
  CommandInteraction,
  InteractionReplyOptions,
  Message,
  MessageReaction,
  MessageType,
  TextChannel,
  User,
} from 'discord.js';

import db from '../../db';
import replyBuilder from '../reply-builder';
import { RealTalkCommand, RealTalkSubcommand } from '../commands/slash-commands';
import { ReactionName } from './message-reactions';
import { StatementRecord } from '../../db/models/statements';
import { StatementWitnessRecord } from '../../db/models/statement-witnesses';
import { cache, Cache, completeStructure, Config, getChannel, Time } from '../../utils';
import { CommandFunction, commandMap } from '../commands';

export type ReactionFunction =
  (client: Client, user: User, reaction: MessageReaction) => Promise<void>;

interface ReactionMap {
  [reaction: string]: ReactionFunction;
}

const RESPONSE_CACHE_DURATION: Readonly<number> = Config.IsDev ? 0 : Time.Hour;
const ACCEPTED_MESSAGE_TYPES: Readonly<MessageType[]> = [ 'DEFAULT', 'REPLY' ];

const reactionResponseCache: Cache = cache.new('reactionResponseCache');

const calcCapThreshold = (max: number): number =>
  Config.IsDev ? 1 : Math.max(1, Math.floor(max * 2 / 3));

const realTalkIsCap = async (_client: Client, user: User, reaction: MessageReaction): Promise<void> => {
  const { message } = reaction;

  if (!message.content) {
    return;
  }

  const fullMessage: Message = await completeStructure<Message>(message);
  const { commandName, user: targetUser } = fullMessage.interaction ?? {};

  if (commandName !== RealTalkCommand.RealTalk) {
    return;
  }

  const statement: StatementRecord = await db.getStatementWhere({
    userId: targetUser?.id,
    url: fullMessage.url,
  });

  if (statement.isCap) {
    await reaction.remove();
    return;
  }

  const witnesses: StatementWitnessRecord[] = await db.getStatementWitnesses(statement.id);

  if (!Config.IsDev) {
    const isWitness: boolean = Boolean(witnesses.find(witness => witness.userId === user.id));
    const isAuthor: boolean = user.id === statement.userId;

    if (isAuthor || !isWitness) {
      await reaction.remove();
      return;
    }
  }

  const capThreshold: number = calcCapThreshold(witnesses.length);
  const capCount: number =
    fullMessage.reactions.cache.filter(r => r.emoji.name === ReactionName.Cap).size;

  if (capCount >= capThreshold) {
    await db.updateStatementWhere({ id: statement.id }, { isCap: true });
    await fullMessage.reply(replyBuilder.realTalkIsCap(statement));
  }
};

const realTalkEmojiReaction = async (client: Client, user: User, reaction: MessageReaction): Promise<void> => {
  const { message } = reaction;

  if (!message.content) {
    return;
  }

  const fullMessage: Message = await completeStructure<Message>(message);
  const isValidReaction: boolean = ACCEPTED_MESSAGE_TYPES.includes(fullMessage.type)
    && fullMessage.author.id !== client.user.id;

  if (!isValidReaction) {
    return;
  }

  const targetUserId: string = fullMessage.author.id;
  const messageContent: string = fullMessage.content;

  const existingStatement: StatementRecord = await db.getStatementWhere({
    accusedUserId: targetUserId,
    content: messageContent,
  });

  const channel: TextChannel = getChannel<TextChannel>(fullMessage.channelId);

  if (existingStatement) {
    const existingRealTalk: string = replyBuilder.realTalkExists(
      user.id,
      existingStatement.url,
    );

    if (reactionResponseCache.isEqual(user.id, existingRealTalk)) {
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
    createdAt: new Date(),
    options: {
      get: (name: string): {value: string} => commandParams[name],
      getSubcommand: (): string => RealTalkSubcommand.RecordBase,
    },
    reply: (options: InteractionReplyOptions) =>
      channel.send(replyBuilder.realTalkEmojiReaction(user.id, options.content)),
    user,
  };

  const realTalkCommand: CommandFunction = commandMap[RealTalkCommand.RealTalk];
  await realTalkCommand(mockInteraction as CommandInteraction, false);
};

export const reactionMap: ReactionMap = {
  [ReactionName.Cap]: realTalkIsCap,
  [ReactionName.RealTalk]: realTalkEmojiReaction,
};
