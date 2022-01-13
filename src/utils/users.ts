export const USER_MENTION_REGEX: Readonly<RegExp> = /^<@[0-9]{18}>$/;
export const NICKNAME_MENTION_REGEX: Readonly<RegExp> = /^<@![0-9]{18}>$/;

/**
 * Tests whether a mention is a valid user or nickname mention.
 *
 * @param   {string} mention - mention to test.
 * @returns {boolean}
 */
export const isMention = (mention: string): boolean =>
  new RegExp(`${USER_MENTION_REGEX.source}|${NICKNAME_MENTION_REGEX.source}`)
    .test(mention);

/**
 * Extracts a user id from nickname mention.
 *
 * @param   {string} mention - user tag to format.
 * @returns {string}
 */
export const extractUserIdFromMention = (mention: string): string =>
  isMention(mention) ? mention.match(/[0-9]{18}/)[0] : '';