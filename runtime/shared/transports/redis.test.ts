import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type Redis from 'ioredis';

import { RedisPublisher } from '@/shared/transports/redis';

const storage = {
  context: new Map<string, unknown>([['x', 1]]),
  types: new Map<string, unknown>(),
};

const createMockRedis = (brpop: () => Promise<unknown>) => {
  const duplicateRedis = {
    brpop: brpop as Redis['brpop'],
    disconnect: () => {},
    removeAllListeners: () => {},
    quit: async () => 'OK' as const,
  };

  return {
    duplicate: () => duplicateRedis,
    lpop: async () => null,
    lpush: async () => 1,
    ping: async () => 'PONG' as const,
    removeAllListeners: () => {},
    quit: async () => 'OK' as const,
  } as unknown as Redis;
};

describe('RedisPublisher getWaitForToolCall', () => {
  it('returns cleanly when reply wait is disposed', async () => {
    const redis = createMockRedis(async () => {
      throw new Error('Connection is closed.');
    });
    const publisher = new RedisPublisher(redis, 'sess-reply-dispose');

    const { disposeWait, wait } = await publisher.pushRequest(
      storage,
      { logic: 'const x = 1;' },
      'req-reply-dispose',
    );

    const waitPromise = wait();

    disposeWait();

    await waitPromise;
  });

  it('returns cleanly when disposed closes the brpop connection', async () => {
    const redis = createMockRedis(async () => {
      throw new Error('Connection is closed.');
    });
    const publisher = new RedisPublisher(redis, 'sess-dispose');

    const { getWaitForToolCall } = await publisher.pushRequest(
      storage,
      { logic: 'const x = 1;' },
      'req-dispose',
    );

    const handlers = getWaitForToolCall(async () => ({
      hasError: false,
      result: 'ok',
    }));

    const waitPromise = handlers.wait();

    handlers.dispose();

    await waitPromise;
  });

  it('throws when connection closes before dispose', async () => {
    const redis = createMockRedis(async () => {
      throw new Error('Connection is closed.');
    });
    const publisher = new RedisPublisher(redis, 'sess-unexpected');

    const { getWaitForToolCall } = await publisher.pushRequest(
      storage,
      { logic: 'const x = 1;' },
      'req-unexpected',
    );

    const handlers = getWaitForToolCall(async () => ({
      hasError: false,
      result: 'ok',
    }));

    await assert.rejects(
      () => handlers.wait(),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, 'Connection is closed.');

        return true;
      },
    );
  });
});
