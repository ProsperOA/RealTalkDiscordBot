import { Message } from "discord.js";

import db from "../../../db";

export type MessageDeleteHandler = (message: Message) => Promise<any>;

const setDeleted = async ({ author, content }: Message): Promise<Date> => {
  const deletedAt: Date = new Date();

  const result: number = await db.updateStatementWhere(
    { userId: author.id, content },
    { deletedAt },
  );

  return result ? deletedAt : null;
};

export default {
  setDeleted,
};
