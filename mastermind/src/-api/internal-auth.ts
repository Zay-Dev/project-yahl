import type { IncomingMessage } from 'http';

import { config } from '../config.js';

const loopbackAddresses = new Set([
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
]);

export const isInternalRequest = (req: IncomingMessage): boolean => {
  const remoteAddress = req.socket.remoteAddress ?? '';

  if (loopbackAddresses.has(remoteAddress)) {
    return true;
  }

  const token = config.internalToken?.trim();

  if (!token) {
    return false;
  }

  const header = req.headers['x-internal-token'];

  return typeof header === 'string' && header.trim() === token;
};
