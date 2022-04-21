import { Message } from "discord.js";

import db from "../../../db";
import { extractStatementContent } from "../../replies";

export type MessageDeleteHandler = (message: Message) => Promise<[number, Date]>;

const hardDelete = async ({ content, url }: Message): Promise<[number, Date]> => {
  const deletedAt: Date = new Date();

  const id: number = await db.deleteStatementWhere({
    content: extractStatementContent(content),
    url,
  });

  return id ? [ id, deletedAt ] : null;
};

const softDelete = async ({ author, content }: Message): Promise<[number, Date]> => {
  const deletedAt: Date = new Date();

  const id: number = await db.updateStatementWhere(
    { accusedUserId: author.id, content },
    { deletedAt },
  );

  return id ? [ id, deletedAt ] : null;
};

export default {
  hardDelete,
  softDelete,
};
