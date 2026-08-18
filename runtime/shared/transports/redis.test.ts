import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type Redis from 'ioredis';

import { RedisPublisher } from '@/shared/transports/redis';

const storage = {
  context: new Map<string, unknown>([['x', 1]]),
  types: new Map<string, unknown>(),
};

const createMockRedis = (
  brpop: () => Promise<unknown>,
  options?: { onLpush?: () => void },
) => {
  const duplicateRedis = {
    brpop: brpop as Redis['brpop'],
    disconnect: () => {},
    removeAllListeners: () => {},
    quit: async () => 'OK' as const,
  };

  return {
    duplicate: () => duplicateRedis,
    lpop: async () => null,
    lpush: async () => {
      options?.onLpush?.();

      return 1;
    },
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

  it('logs error envelope before throw', async () => {
    const logs: string[] = [];
    const origLog = console.log;

    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
      origLog(...args);
    };

    let callCount = 0;
    const redis = createMockRedis(async () => {
      callCount += 1;

      if (callCount === 1) {
        return [
          'yahl:reply:req-error-log',
          JSON.stringify({
            output: {
              error: {
                message: 'fetch failed',
                name: 'Error',
                stack: 'Error: fetch failed\n    at wait',
              },
              message: 'fetch failed',
            },
            type: 'error',
          }),
        ];
      }

      return null;
    });
    const publisher = new RedisPublisher(redis, 'sess-error-log');

    const { wait } = await publisher.pushRequest(
      storage,
      { logic: 'const x = 1;' },
      'req-error-log',
    );

    await assert.rejects(
      () => wait(),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, 'fetch failed');

        return true;
      },
    );

    const errorLog = logs.find((line) => line.includes('[yahl-diag] reply error'));

    assert.ok(errorLog);
    assert.match(errorLog!, /requestId=req-error-log/);
    assert.match(errorLog!, /elapsedMs=/);
    assert.match(errorLog!, /message=fetch failed/);

    console.log = origLog;
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

  it('awaits sessionTracker.flush before lpush', async () => {
    const previousTracker = (globalThis as { sessionTracker?: { flush?: () => Promise<void> } })
      .sessionTracker;
    let flushResolved = false;
    let lpushAfterFlush = false;

    (globalThis as { sessionTracker?: { flush?: () => Promise<void> } }).sessionTracker = {
      flush: async () => {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 20);
        });
        flushResolved = true;
      },
    };

    const redis = createMockRedis(
      async () => null,
      {
        onLpush: () => {
          lpushAfterFlush = flushResolved;
        },
      },
    );
    const publisher = new RedisPublisher(redis, 'sess-flush-before-lpush');

    try {
      await publisher.pushRequest(
        storage,
        { logic: 'const x = 1;' },
        'req-flush-before-lpush',
      );

      assert.equal(flushResolved, true);
      assert.equal(lpushAfterFlush, true);
    } finally {
      (globalThis as { sessionTracker?: { flush?: () => Promise<void> } }).sessionTracker =
        previousTracker;
    }
  });
});
