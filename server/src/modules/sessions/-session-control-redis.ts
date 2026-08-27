import Redis from 'ioredis';

const CONTROL_KEY_PREFIX = 'yahl:control:';
const PAUSE_REQUESTED = 'pause_requested';
const PAUSE_TTL_SECONDS = 86_400;

let redisClient: Redis | null = null;

const _resolveRedisUrl = () => process.env.REDIS_URL?.trim() || 'redis://redis:6379';

const _getRedis = () => {
  if (!redisClient) {
    redisClient = new Redis(_resolveRedisUrl(), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  return redisClient;
};

export const sessionControlKey = (sessionId: string) => `${CONTROL_KEY_PREFIX}${sessionId}`;

export const requestSessionPause = async (sessionId: string) => {
  const redis = _getRedis();
  await redis.set(sessionControlKey(sessionId), PAUSE_REQUESTED, 'EX', PAUSE_TTL_SECONDS);
};

export const clearSessionControl = async (sessionId: string) => {
  const redis = _getRedis();
  await redis.del(sessionControlKey(sessionId));
};

export const readSessionPauseRequested = async (sessionId: string) => {
  const redis = _getRedis();
  const value = await redis.get(sessionControlKey(sessionId));

  return value === PAUSE_REQUESTED;
};
