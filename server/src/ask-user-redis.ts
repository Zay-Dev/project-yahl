import Redis from "ioredis";

export const askUserAnsweredChannelId = (sessionId: string) =>
  `yahl:ask-user-answered:${sessionId}`;

let shared: Redis | null = null;

export const getAskUserRedis = (): Redis | null => {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;

  if (!shared) {
    shared = new Redis(url, { maxRetriesPerRequest: 2 });
  }

  return shared;
};

export const publishAskUserAnswered = async (sessionId: string, questionId: string) => {
  const redis = getAskUserRedis();
  if (!redis) return;

  try {
    await redis.publish(askUserAnsweredChannelId(sessionId), JSON.stringify({ questionId }));
  } catch (error) {
    console.error(`[ask-user] redis publish failed: ${String(error)}`);
  }
};
