import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createStorage } from '@/orchestrator/-tools/set_context';

import type { createSessionEventTracker } from './session-event-tracker';

import { publishSessionResult } from './session-result';

type TSessionTracker = ReturnType<typeof createSessionEventTracker>;

const createSessionTrackerStub = (
  overrides: Partial<Pick<TSessionTracker, 'flush' | 'patchSession'>>,
): TSessionTracker => ({
  appendModelResponse: () => {},
  appendToolCall: () => {},
  appendToolResult: () => {},
  createStage: () => {},
  flush: async () => {},
  patchSession: () => {},
  patchStage: () => {},
  registerSession: async () => {},
  ...overrides,
});

describe('publishSessionResult', () => {
  it('patches null when resultContextKey is missing from context', async () => {
    const storage = createStorage();
    const patched: { result?: unknown } = {};

    globalThis.sessionTracker = createSessionTrackerStub({
      flush: async () => {},
      patchSession: async (_sessionId: string, body: { result?: unknown }) => {
        patched.result = body.result;
      },
    });

    await publishSessionResult('sess-1', 'result', storage);

    assert.equal(patched.result, null);
  });

  it('patches the context value when the key exists', async () => {
    const storage = createStorage();

    storage.context.set('result', { a: 1 });

    const patched: { result?: unknown } = {};

    globalThis.sessionTracker = createSessionTrackerStub({
      flush: async () => {},
      patchSession: async (_sessionId: string, body: { result?: unknown }) => {
        patched.result = body.result;
      },
    });

    await publishSessionResult('sess-1', 'result', storage);

    assert.deepEqual(patched.result, { a: 1 });
  });

  it('no-ops when resultContextKey is not configured', async () => {
    const storage = createStorage();
    let called = false;

    globalThis.sessionTracker = createSessionTrackerStub({
      flush: async () => {},
      patchSession: async () => {
        called = true;
      },
    });

    await publishSessionResult('sess-1', undefined, storage);

    assert.equal(called, false);
  });
});
