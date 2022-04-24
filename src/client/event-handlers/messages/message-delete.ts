import { Message } from "discord.js";

import db from "../../../db";
import { extractStatementContent } from "../../replies";

export type MessageDeleteHandler = (message: Message) => Promise<number>;

const hardDelete = async ({ content, url }: Message): Promise<number> =>
  db.deleteStatementWhere({
    content: extractStatementContent(content),
    url,
  });

const softDelete = async ({ author, content }: Message): Promise<number> =>
  db.updateStatementWhere(
    { accusedUserId: author.id, content },
    { deletedAt: new Date() },
  );

export default {
  hardDelete,
  softDelete,
};
