import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type Redis from 'ioredis';

import { RedisPublisher, RedisSubscriber } from '@/shared/transports/redis';

const storage = {
  context: new Map<string, unknown>([['x', 1]]),
  types: new Map<string, unknown>(),
};

const createMockRedis = (
  brpop: () => Promise<unknown>,
  options?: {
    onLpush?: () => void;
    lpopQueue?: string[];
  },
) => {
  const queue = [...(options?.lpopQueue ?? [])];

  const duplicateRedis = {
    brpop: brpop as Redis['brpop'],
    disconnected: false,
    disconnect: () => {
      duplicateRedis.disconnected = true;
    },
    removeAllListeners: () => {},
    quit: async () => 'OK' as const,
  };

  duplicateRedis.brpop = (async (...args: unknown[]) => {
    if (duplicateRedis.disconnected) {
      throw new Error('Connection is closed.');
    }

    return brpop(...args);
  }) as Redis['brpop'];

  return {
    duplicate: () => duplicateRedis,
    lpop: async () => queue.shift() ?? null,
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

    disposeWait();
  });

  it('returns cleanly when disposed closes the brpop connection', async () => {
    const redis = createMockRedis(async () => {
      throw new Error('Connection is closed.');
    });
    const publisher = new RedisPublisher(redis, 'sess-dispose');

    const { disposeWait, getWaitForToolCall } = await publisher.pushRequest(
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

    disposeWait();
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

    const { disposeWait, wait } = await publisher.pushRequest(
      storage,
      { logic: 'const x = 1;' },
      'req-error-log',
    );

    try {
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
    } finally {
      disposeWait();
      console.log = origLog;
    }
  });

  it('throws when connection closes before dispose', async () => {
    const redis = createMockRedis(async () => {
      throw new Error('Connection is closed.');
    });
    const publisher = new RedisPublisher(redis, 'sess-unexpected');

    const { disposeWait, getWaitForToolCall } = await publisher.pushRequest(
      storage,
      { logic: 'const x = 1;' },
      'req-unexpected',
    );

    const handlers = getWaitForToolCall(async () => ({
      hasError: false,
      result: 'ok',
    }));

    try {
      await assert.rejects(
        () => handlers.wait(),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal(error.message, 'Connection is closed.');

          return true;
        },
      );
    } finally {
      handlers.dispose();
      disposeWait();
    }
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
      const { disposeWait } = await publisher.pushRequest(
        storage,
        { logic: 'const x = 1;' },
        'req-flush-before-lpush',
        { skipStageCreate: true },
      );

      assert.equal(flushResolved, true);
      assert.equal(lpushAfterFlush, true);

      disposeWait();
    } finally {
      (globalThis as { sessionTracker?: { flush?: () => Promise<void> } }).sessionTracker =
        previousTracker;
    }
  });
});

describe('RedisPublisher local tool results', () => {
  it('emits persisted stdout for agent-local tools', async () => {
    const sessionId = 'sess-local-tool';
    const requestId = 'req-local-tool';
    const toolCallChannel = `yahl:tool:${sessionId}:${requestId}`;
    const localResultChannel = `yahl:local-tool-result:${sessionId}:${requestId}`;
    const toolCall = {
      function: { arguments: '{"command":"cat SKILL.md"}', name: 'run_bash' },
      id: 'call-local-1',
      type: 'function',
    };
    const modelResponseChannel = `yahl:model-response:${sessionId}:${requestId}`;
    let waitCalls = 0;
    let disconnected = false;
    const emitted: { result: string; toolCallId: string }[] = [];

    const redis = {
      duplicate: () => ({
        brpop: async (...args: unknown[]) => {
          if (disconnected) {
            throw new Error('Connection is closed.');
          }

          const firstKey = args[0] as string;

          if (firstKey === toolCallChannel) {
            waitCalls += 1;

            return [toolCallChannel, JSON.stringify(toolCall)];
          }

          if (firstKey === localResultChannel) {
            return [
              localResultChannel,
              JSON.stringify({
                hasError: false,
                result: '# route-analysis\n',
                toolCallId: toolCall.id,
              }),
            ];
          }

          if (firstKey === modelResponseChannel) {
            return null;
          }

          return null;
        },
        disconnect: () => {
          disconnected = true;
        },
        quit: async () => 'OK' as const,
      }),
      lpop: async () => null,
      lpush: async () => 1,
      ping: async () => 'PONG' as const,
      removeAllListeners: () => {},
      quit: async () => 'OK' as const,
    } as unknown as Redis;

    const publisher = new RedisPublisher(redis, sessionId);

    publisher.on('toolCallResult', (envelope) => {
      emitted.push(envelope);
    });

    const { disposeWait, getWaitForToolCall } = await publisher.pushRequest(
      storage,
      { logic: 'const x = 1;' },
      requestId,
      { skipStageCreate: true },
    );

    const handlers = getWaitForToolCall(async () => ({
      hasError: true,
      result: 'orchestrator callback should not run for local tools',
    }));

    const waitPromise = handlers.wait();

    await new Promise<void>((resolve) => {
      publisher.once('toolCallResult', () => {
        resolve();
      });
    });

    handlers.dispose();
    disposeWait();
    await waitPromise;

    assert.equal(waitCalls, 1);
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0]?.toolCallId, toolCall.id);
    assert.equal(emitted[0]?.result, '# route-analysis\n');
  });
});

describe('RedisSubscriber orchestrator tool results', () => {
  it('matches tool results to tool_call_id and re-queues orphans', async () => {
    const sessionId = 'sess-orchestrator-tool';
    const requestId = 'req-orchestrator-tool';
    const toolResultChannel = `yahl:tool-result:${sessionId}:${requestId}`;
    const toolCallChannel = `yahl:tool:${sessionId}:${requestId}`;
    const firstCall = {
      function: { arguments: '{"key":"a"}', name: 'set_context' },
      id: 'call-first',
      type: 'function',
    };
    const secondCall = {
      function: { arguments: '{"key":"b"}', name: 'set_context' },
      id: 'call-second',
      type: 'function',
    };
    const queuedResults = [
      JSON.stringify({ hasError: false, result: 'second', toolCallId: 'call-second' }),
      JSON.stringify({ hasError: false, result: 'first', toolCallId: 'call-first' }),
    ];

    const redis = {
      brpop: async (...args: unknown[]) => {
        const key = args[0] as string;

        if (key === toolResultChannel) {
          return queuedResults.length > 0
            ? [toolResultChannel, queuedResults.pop()!]
            : null;
        }

        return null;
      },
      duplicate: () => redis,
      lpush: async () => 1,
      lpop: async () => null,
      ping: async () => 'PONG' as const,
      quit: async () => 'OK' as const,
      removeAllListeners: () => {},
    } as unknown as Redis;

    const subscriber = new RedisSubscriber(redis, sessionId);
    const reply = subscriber.getReply(requestId);

    const firstResult = await reply.toolCall(firstCall);

    assert.equal(firstResult.result, 'first');

    const secondResult = await reply.toolCall(secondCall);

    assert.equal(secondResult.result, 'second');
  });

  it('buffers out-of-order orchestrator tool results by tool_call_id', async () => {
    const sessionId = 'sess-orchestrator-orphan';
    const requestId = 'req-orchestrator-orphan';
    const toolResultChannel = `yahl:tool-result:${sessionId}:${requestId}`;
    const firstCall = {
      function: { arguments: '{"key":"a"}', name: 'set_context' },
      id: 'call-first',
      type: 'function',
    };
    const queuedResults = [
      JSON.stringify({ hasError: false, result: 'first', toolCallId: 'call-first' }),
      JSON.stringify({ hasError: false, result: 'second', toolCallId: 'call-second' }),
    ];

    const redis = {
      brpop: async (...args: unknown[]) => {
        const key = args[0] as string;

        if (key === toolResultChannel) {
          return queuedResults.length > 0
            ? [toolResultChannel, queuedResults.pop()!]
            : null;
        }

        return null;
      },
      duplicate: () => redis,
      lpush: async () => 1,
      lpop: async () => null,
      ping: async () => 'PONG' as const,
      quit: async () => 'OK' as const,
      removeAllListeners: () => {},
    } as unknown as Redis;

    const subscriber = new RedisSubscriber(redis, sessionId);
    const reply = subscriber.getReply(requestId);

    const firstResult = await reply.toolCall(firstCall);

    assert.equal(firstResult.result, 'first');
  });
});

describe('RedisPublisher drainRequestQueue', () => {
  it('pops all pending request envelopes and returns the count', async () => {
    const redis = createMockRedis(async () => null, {
      lpopQueue: ['{"requestId":"stale-1"}', '{"requestId":"stale-2"}'],
    });
    const publisher = new RedisPublisher(redis, 'sess-drain');

    const drained = await publisher.drainRequestQueue();

    assert.equal(drained, 2);
    assert.equal(await publisher.drainRequestQueue(), 0);
  });
});
