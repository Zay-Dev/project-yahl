import Redis from 'ioredis';

import config from '@/orchestrator/config';

const CONTROL_KEY_PREFIX = 'yahl:control:';
const PAUSE_REQUESTED = 'pause_requested';

let redisClient: Redis | null = null;

const _getRedis = () => {
  if (!redisClient) {
    redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
    });
  }

  return redisClient;
};

export const sessionControlKey = (sessionId: string) => `${CONTROL_KEY_PREFIX}${sessionId}`;

export const readSessionPauseRequested = async (sessionId: string) => {
  const value = await _getRedis().get(sessionControlKey(sessionId));

  return value === PAUSE_REQUESTED;
};

export const clearSessionControl = async (sessionId: string) => {
  await _getRedis().del(sessionControlKey(sessionId));
};
