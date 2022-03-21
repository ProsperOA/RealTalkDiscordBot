import { Message } from "discord.js";

import db from "../../../db";
import { buildMessageUrl } from "../../../utils";

export type MessageDeleteHandler = (message: Message) => Promise<any>;

const setDeleted = async (message: Message): Promise<Date> => {
  const deletedAt: Date = new Date();

  const result: number = await db.updateStatementWhere(
    { url: buildMessageUrl(message) },
    { deletedAt },
  );

  return result ? deletedAt : null;
};

export default {
  setDeleted,
};
