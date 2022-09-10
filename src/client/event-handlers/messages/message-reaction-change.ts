import {
  Client,
  CommandInteraction,
  InteractionReplyOptions,
  Message,
  MessageReaction,
  MessageType,
  TextChannel,
  User,
} from "discord.js";

import db from "../../../db";
import interactionHandlers from "../interactions";
import replies, { extractStatementContent } from "../../replies";
import { InteractionCreateHandler } from "../interactions/interaction-create";
import { MessageReactionName } from "../../message-reactions";
import { RealTalkCommand, RealTalkSubcommand } from "../../slash-commands";
import { Statement, StatementWitness } from "../../../db/models";
import { cache, Cache, completeStructure, Config, getMember, getUser, Time } from "../../../utils";

export type MessageReactionChangeType = "add" | "remove";

export type MessageReactionHandler =
  (client: Client, user: User, reaction: MessageReaction, type: MessageReactionChangeType) => Promise<void>;

const RESPONSE_CACHE_DURATION: number = Config.IsDev ? 0 : Time.Hour;
const ACCEPTED_MESSAGE_TYPES: ReadonlyArray<MessageType> = [ "DEFAULT", "REPLY" ];

const emojiReactionCache: Cache = cache.new("responseCache");

const calcCapThreshold = (max: number): number =>
  Config.IsDev ? 1 : Math.max(1, Math.floor(max * 2 / 3));

const realTalkIsCap = async (_client: Client, user: User, reaction: MessageReaction, type: MessageReactionChangeType): Promise<void> => {
  if (type === "remove") {
    return;
  }

  const { message }: MessageReaction = reaction;

  if (!message.content) {
    return;
  }

  const fullMessage: Message = await completeStructure<Message>(message);
  const { interaction }: Message = fullMessage;

  if (interaction?.commandName !== RealTalkCommand.RealTalk) {
    return;
  }

  const statement: Statement = await db.getStatementWhere({
    userId: interaction.user.id,
    url: fullMessage.url,
  });

  if (statement.isCap) {
    await reaction.remove();
    return;
  }

  const witnesses: StatementWitness[] = await db.getStatementWitnesses(statement.id);

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
    fullMessage.reactions.cache.filter(r => r.emoji.name === MessageReactionName.Cap).size;

  if (capCount >= capThreshold) {
    await db.updateStatementWhere({ id: statement.id }, { isCap: true });
    await fullMessage.reply(replies.realTalkIsCap(statement));
  }
};

const realTalkEmojiReaction = async (client: Client, user: User, reaction: MessageReaction, type: MessageReactionChangeType): Promise<void> => {
  if (type === "remove") {
    return;
  }

  const { message }: MessageReaction = reaction;

  if (message.author.id === client.user.id) {
    await reaction.remove();
    return;
  }

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

  const existingStatement: Statement = await db.getStatementWhere({
    accusedUserId: targetUserId,
    content: messageContent,
  });

  const channel: TextChannel = await client.channels.fetch(fullMessage.channelId) as TextChannel;

  if (existingStatement) {
    const existingRealTalk: string = replies.realTalkExists(
      user.id,
      existingStatement.url,
    );

    if (emojiReactionCache.equals(user.id, existingRealTalk)) {
      await channel.send(existingRealTalk);
      emojiReactionCache.setF(user.id, existingRealTalk, RESPONSE_CACHE_DURATION);
    }

    return;
  }

  const mockInteraction: any = {
    channelId: fullMessage.channelId,
    createdAt: new Date(),
    deleteReply: async (): Promise<void> => {
      await reaction.remove();
    },
    member: getMember(targetUserId),
    options: {
      getUser: (): User => getUser(targetUserId),
      getString: (): string => messageContent,
      getSubcommand: (): string => RealTalkSubcommand.Record,
    },
    reply: (options: InteractionReplyOptions): Promise<Message> =>
      channel.send(replies.realTalkEmojiReaction(user.id, options.content)),
    user,
  };

  const realTalkCommand: InteractionCreateHandler = interactionHandlers[RealTalkCommand.RealTalk];
  await realTalkCommand(client, mockInteraction as CommandInteraction, false);
};

const realTalkUpdoot = async (_client: Client, user: User, reaction: MessageReaction, type: MessageReactionChangeType): Promise<void> => {
  const statement: Statement = await db.getStatementWhere({
    content: extractStatementContent(reaction.message.content)
  });

  if (!statement) {
    return;
  }

  if (type === "add") {
    await db.addUpdoot({
      statementId: statement.id,
      userId: user.id,
      createdAt: new Date(),
    });

    return;
  }

  await db.deleteUpdoot({
    userId: user.id,
    statementId: statement.id,
  });
};

export default {
  [MessageReactionName.Cap]: realTalkIsCap,
  [MessageReactionName.RealTalk]: realTalkEmojiReaction,
  [MessageReactionName.Updoot]: realTalkUpdoot,
};
