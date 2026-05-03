import config from "./config";

import Redis from "ioredis";
import { RedisSubscriber } from '@/shared/transports/redis';

declare global {
  var subscriber: RedisSubscriber;
}

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 2,
});

globalThis.subscriber = new RedisSubscriber(redis, config.cliOptions.sessionId);

const run = async () => {
  const { startRedisDaemon } = await import("./redis-daemon");

  await startRedisDaemon();
};

run()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Agent Error] ${message}\n`);
    process.exit(1);
  })
  .finally(() => {
    void globalThis.subscriber?.close().catch(() => { });
  });
