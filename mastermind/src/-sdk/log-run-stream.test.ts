import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import type { Run, SDKMessage } from '@cursor/sdk';

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

const assistantDelta = (text: string): SDKMessage => ({
  agent_id: 'agent-1',
  message: {
    content: [{ text, type: 'text' }],
    role: 'assistant',
  },
  run_id: 'run-1',
  type: 'assistant',
});

const userDelta = (text: string): SDKMessage => ({
  agent_id: 'agent-1',
  message: {
    content: [{ text, type: 'text' }],
    role: 'user',
  },
  run_id: 'run-1',
  type: 'user',
});

const captureLogs = async (fn: () => Promise<void>) => {
  const lines: string[] = [];
  const originalLog = console.log;

  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };

  try {
    await fn();
  } finally {
    console.log = originalLog;
  }

  return lines;
};

describe('logRunStreamIfEnabled', () => {
  it('does nothing when MASTERMIND_SDK_STREAM_LOG is unset', async () => {
    delete process.env.MASTERMIND_SDK_STREAM_LOG;

    const { logRunStreamIfEnabled } = await import('./log-run-stream.js');

    const logs = await captureLogs(async () => {
      await logRunStreamIfEnabled(fakeRun([{ type: 'status' }]));
    });

    assert.equal(logs.length, 0);
  });
});

describe('logSdkStreamEvent', () => {
  it('prints meta once and body per assistant delta', async () => {
    const { createSdkStreamLogState, logSdkStreamEvent } = await import('./log-run-stream.js');

    const state = createSdkStreamLogState();
    const logs = await captureLogs(async () => {
      logSdkStreamEvent(assistantDelta(' Identity'), state);
      logSdkStreamEvent(assistantDelta(' Summary'), state);
    });

    const metaLines = logs.filter((line) => line.includes('[sdk-stream] meta'));
    const bodyLines = logs.filter((line) => line.includes('[sdk-stream] body'));

    assert.equal(metaLines.length, 1);
    assert.equal(bodyLines.length, 2);
    assert.match(metaLines[0]!, /"type":"assistant"/);
    assert.match(metaLines[0]!, /"role":"assistant"/);
    assert.match(logs.join('\n'), /"text": " Identity"/);
    assert.match(logs.join('\n'), /"text": " Summary"/);
    assert.doesNotMatch(logs.join('\n'), /"message":/);
  });

  it('prints meta again when role changes', async () => {
    const { createSdkStreamLogState, logSdkStreamEvent } = await import('./log-run-stream.js');

    const state = createSdkStreamLogState();
    const logs = await captureLogs(async () => {
      logSdkStreamEvent(assistantDelta('hello'), state);
      logSdkStreamEvent(userDelta('reply'), state);
    });

    const metaLines = logs.filter((line) => line.includes('[sdk-stream] meta'));

    assert.equal(metaLines.length, 2);
    assert.match(metaLines[0]!, /"role":"assistant"/);
    assert.match(metaLines[1]!, /"role":"user"/);
  });
});
