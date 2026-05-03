import config from "./config";

import Redis from "ioredis";
import { RedisPublisher } from '@/shared/transports/redis';

import { main } from "./main";
import { resolveCliOptions } from "./cli-options";

declare global {
  var publisher: RedisPublisher;
}

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 2,
});

resolveCliOptions()
  .then(cli => {
    globalThis.publisher = new RedisPublisher(redis, cli.sessionId);

    return main(cli);
  })
  .catch((error: unknown) => {
    throw error;
  })
  .finally(() => {
    void globalThis.publisher?.close().catch(() => { });
  });
