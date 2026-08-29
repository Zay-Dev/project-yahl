import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dedupeReplayRowsByStageSlot, replayRowSlotKey } from './replay-dedupe';

describe('replayRowSlotKey', () => {
  it('distinguishes nested siblings in the same while iteration', () => {
    const bind = replayRowSlotKey({
      agentMeta: { nestedIndex: 0, nestedPath: 'monitor/bind' },
      loopMeta: { index: 1, kind: 'while' },
      parsedStageIndex: 10,
    });
    const sleep = replayRowSlotKey({
      agentMeta: { nestedIndex: 8, nestedPath: 'monitor/sleep' },
      loopMeta: { index: 1, kind: 'while' },
      parsedStageIndex: 10,
    });
    const warmup = replayRowSlotKey({
      loopMeta: { index: 0, kind: 'warmup' },
      parsedStageIndex: 10,
    });
    const body0 = replayRowSlotKey({
      agentMeta: { nestedIndex: 0, nestedPath: 'monitor/bind' },
      loopMeta: { index: 0, kind: 'while' },
      parsedStageIndex: 10,
    });

    assert.notEqual(bind, sleep);
    assert.notEqual(warmup, body0);
  });
});

describe('dedupeReplayRowsByStageSlot', () => {
  it('keeps all nested children before an anchor in the same iteration', () => {
    const rows = [
      {
        agentMeta: { nestedIndex: 0, nestedPath: 'monitor/bind' },
        loopMeta: { index: 1, kind: 'while' as const },
        parsedStageIndex: 10,
        stageId: 'bind',
      },
      {
        agentMeta: { nestedIndex: 1, nestedPath: 'monitor/goto' },
        loopMeta: { index: 1, kind: 'while' as const },
        parsedStageIndex: 10,
        stageId: 'goto',
      },
      {
        agentMeta: { nestedIndex: 2, nestedPath: 'monitor/notify' },
        loopMeta: { index: 1, kind: 'while' as const },
        parsedStageIndex: 10,
        stageId: 'notify',
      },
    ];

    const kept = dedupeReplayRowsByStageSlot(rows);

    assert.deepEqual(kept.map((row) => row.stageId), ['bind', 'goto', 'notify']);
  });
});
