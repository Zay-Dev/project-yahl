import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import type { Run } from '@cursor/sdk';

const previousSdkStreamLog = process.env.MASTERMIND_SDK_STREAM_LOG;

afterEach(() => {
  if (previousSdkStreamLog === undefined) {
    delete process.env.MASTERMIND_SDK_STREAM_LOG;
  } else {
    process.env.MASTERMIND_SDK_STREAM_LOG = previousSdkStreamLog;
  }
});

const fakeRun = (events: unknown[]): Run => ({
  agentId: 'agent-1',
  cancel: async () => {},
  conversation: async () => [],
  createdAt: Date.now(),
  id: 'run-1',
  onDidChangeStatus: () => () => {},
  status: 'running',
  stream: async function* () {
    for (const event of events) {
      yield event as never;
    }
  },
  supports: (operation) => operation === 'stream',
  unsupportedReason: () => undefined,
  wait: async () => ({
    id: 'run-1',
    status: 'finished' as const,
  }),
});

describe('logRunStreamIfEnabled', () => {
  it('does nothing when MASTERMIND_SDK_STREAM_LOG is unset', async () => {
    delete process.env.MASTERMIND_SDK_STREAM_LOG;

    const { logRunStreamIfEnabled } = await import('./log-run-stream.js');

    const logs: unknown[] = [];
    const originalLog = console.log;

    console.log = (...args: unknown[]) => {
      logs.push(args);
    };

    try {
      await logRunStreamIfEnabled(fakeRun([{ type: 'status' }]));
    } finally {
      console.log = originalLog;
    }

    assert.equal(logs.length, 0);
  });
});
