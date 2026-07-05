import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mergeForkSessionSetups } from './merge-fork-setups';

const row = (
  stageId: string,
  logic: string,
  overrides: Partial<{
    context: Record<string, unknown>;
    loopMeta: { arraySnapshot: unknown[]; index: number; value: unknown };
  }> = {},
) => ({
  context: overrides.context ?? {},
  loopMeta: overrides.loopMeta,
  requestId: `r-${stageId}`,
  stage: { logic },
  stageId,
});

describe('mergeForkSessionSetups', () => {
  it('fills gap between anchor and non-adjacent later user setup', () => {
    const replayRows = [
      row('s1', 'a'),
      row('s2', 'b', { loopMeta: { arraySnapshot: [], index: 0, value: 1 } }),
      row('s3', 'c', { loopMeta: { arraySnapshot: [], index: 1, value: 2 } }),
      row('s4', 'd'),
    ];
    const userSetups = [
      {
        context: { edited: true },
        loopMeta: replayRows[1]!.loopMeta,
        stage: { logic: 'b-edited' },
        stageId: 's2',
      },
      {
        context: {},
        stage: { logic: 'd-edited' },
        stageId: 's4',
      },
    ];

    const merged = mergeForkSessionSetups(replayRows, 1, userSetups);

    assert.deepEqual(merged.map((item) => item.stageId), ['s2', 's3', 's4']);
    assert.equal(merged[0]?.stage.logic, 'b-edited');
    assert.equal(merged[1]?.stage.logic, 'c');
    assert.equal(merged[2]?.stage.logic, 'd-edited');
  });

  it('returns anchor-only slice when user submits anchor alone', () => {
    const replayRows = [row('a', '1'), row('b', '2'), row('c', '3')];
    const userSetups = [
      { context: {}, stage: { logic: '2-new' }, stageId: 'b' },
    ];

    const merged = mergeForkSessionSetups(replayRows, 1, userSetups);

    assert.deepEqual(merged.map((item) => item.stageId), ['b', 'c']);
    assert.equal(merged[0]?.stage.logic, '2-new');
    assert.equal(merged[1]?.stage.logic, '3');
  });

  it('preserves later user setup without temperature when anchor is earlier', () => {
    const replayRows = [
      row('s1', 'a'),
      row('s2', 'b'),
      row('s3', 'c', { context: {} }),
    ];
    const userSetups = [
      { context: {}, stage: { logic: 'b-new' }, stageId: 's2' },
      { context: {}, stage: { logic: 'c-no-temp' }, stageId: 's3' },
    ];

    const merged = mergeForkSessionSetups(replayRows, 1, userSetups);

    assert.equal(merged[1]?.stage.logic, 'c-no-temp');
    assert.equal(merged[1]?.stage.temperature, undefined);
  });
});
