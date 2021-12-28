/**
 * Returns remaining time for setTimeout.
 *
 * @param   {any}    timeout - Reference to timeout object.
 * @returns {number}
 */
export const getRemainingTimeout = ({ _idleStart, _idleTimeout }: any): number =>
  Math.ceil((_idleStart + _idleTimeout) / 1000 - process.uptime());
