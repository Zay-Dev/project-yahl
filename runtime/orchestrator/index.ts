import config from "./config";

import Redis from "ioredis";
import { RedisPublisher } from '@/shared/transports/redis';

import { main } from "./main";
import { resolveCliOptions } from "./cli-options";
import { initForkRunManager } from './forkrun-manager';

declare global {
  var publisher: RedisPublisher;
  var forkRunManager: undefined | Awaited<ReturnType<typeof initForkRunManager>>;
}

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 2,
});

resolveCliOptions()
  .then(async cli => {
    const rerunMode = Boolean(cli.resume);
    globalThis.forkRunManager = rerunMode ?
      await initForkRunManager(cli.resume!.sourceSessionId, cli.resume!.forkrunFormId || "") :
      undefined;

    return cli;
  })
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
