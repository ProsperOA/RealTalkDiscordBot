import {
  Client,
  CommandInteraction,
  InteractionReplyOptions,
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
import { cache, Cache, Config, fetchFull, Time } from '../utils';
import { CommandFunction, commandInterfaceMap } from './command-interface';

export type ReactionFunction =
  (client: Client, user: User, reaction: MessageReaction) => Promise<void>;

interface ReactionInterfaceMap {
  [reaction: string]: ReactionFunction;
}

const RESPONSE_CACHE_DURATION: Readonly<number> = Config.IsDev ? 0 : Time.Hour;
const ACCEPTED_MESSAGE_TYPES: Readonly<string[]> = [ 'DEFAULT', 'REPLY' ];

const reactionResponseCache: Cache = cache.new('reactionResponseCache');

const calcCapThreshold = (max: number): number =>
  Config.IsDev ? 1 : Math.max(1, Math.floor(max * 2 / 3));

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
    userId: targetUser.id,
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

  const fullMessage: Message = message.partial
    ? await fetchFull<Message>(message)
    : message as Message;

  if (!fullMessage) {
    await user.send(replyBuilder.internalError().content);
    return;
  }

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

  const channel: TextChannel = client.channels.cache.get(fullMessage.channelId) as TextChannel;

  if (existingStatement) {
    const existingRealTalk: string = replyBuilder.realTalkExists(
      user.id,
      existingStatement.url,
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
      get: (name: string): {value: string} => commandParams[name],
      getSubcommand: (): string => RealTalkSubcommand.RecordBase,
    },
    reply: (options: InteractionReplyOptions) =>
      channel.send(replyBuilder.realTalkEmojiReaction(user.id, options.content)),
    user,
  };

  const realTalkCommand: CommandFunction = commandInterfaceMap[RealTalkCommand.RealTalk];
  await realTalkCommand(client, mockInteraction as CommandInteraction, false);
};

export const reactionInterfaceMap: ReactionInterfaceMap = {
  [ReactionName.Cap]: realTalkIsCap,
  [ReactionName.RealTalk]: realTalkEmojiReaction,
};
