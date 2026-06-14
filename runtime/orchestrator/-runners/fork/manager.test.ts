import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ForkSessionManager } from './manager';

const row = (
  stageId: string,
  logic: string,
  overrides: Partial<{
    contextAfter: Record<string, unknown>;
    loopMeta: { arraySnapshot: unknown[]; index: number; value: unknown };
  }> = {},
) => ({
  context: {},
  contextAfter: overrides.contextAfter,
  loopMeta: overrides.loopMeta,
  requestId: `r-${stageId}`,
  stage: { logic },
  stageId,
});

describe('ForkSessionManager', () => {
  it('splits prefix rows before anchor index', () => {
    const sourceRows = [
      row('a', 'a', { contextAfter: { context: {} } }),
      row('b', 'b', { contextAfter: { context: {} } }),
      row('c', 'c'),
    ];
    const forkSession = {
      anchorStageId: 'b',
      forkSessionId: 'fork-1',
      setups: [
        { stageId: 'b', context: {}, stage: { logic: 'b2' } },
        { stageId: 'c', context: {}, stage: { logic: 'c2' } },
      ],
      sourceSessionId: 'src',
      targetSessionId: 'tgt',
    };

    const manager = new ForkSessionManager(forkSession, sourceRows);

    assert.equal(manager.getAnchorIndex(), 1);
    assert.equal(manager.getPrefixRows().length, 1);
    assert.equal(manager.getPrefixRows()[0]?.stageId, 'a');
    assert.equal(manager.getSuffixSetups().length, 2);
  });

  it('buildExecutionPlan fast-forwards before anchor then runs setups', () => {
    const sourceRows = [
      row('a', 'a', { contextAfter: { context: { x: 1 } } }),
      row('b', 'b', { contextAfter: { context: { x: 2 } } }),
      row('c', 'c'),
    ];
    const forkSession = {
      anchorStageId: 'b',
      forkSessionId: 'fork-1',
      setups: [
        { stageId: 'b', context: {}, stage: { logic: 'b2' } },
        { stageId: 'c', context: {}, stage: { logic: 'c2' } },
      ],
      sourceSessionId: 'src',
      targetSessionId: 'tgt',
    };

    const manager = new ForkSessionManager(forkSession, sourceRows);
    const plan = manager.buildExecutionPlan();

    assert.equal(plan.length, 3);
    assert.equal(plan[0]?.kind, 'fastForward');
    assert.equal(plan[0]?.kind === 'fastForward' && plan[0].row.stageId, 'a');
    assert.equal(plan[1]?.kind, 'run');
    assert.equal(plan[1]?.kind === 'run' && plan[1].setup.stageId, 'b');
    assert.equal(plan[2]?.kind === 'run' && plan[2].kind === 'run' && plan[2].setup.stageId, 'c');
  });

  it('fast-forwards loop iterations before anchor and runs from selected iteration', () => {
    const loopMeta = { arraySnapshot: [1, 2], index: 0, value: 1 };
    const loopMeta1 = { arraySnapshot: [1, 2], index: 1, value: 2 };
    const sourceRows = [
      row('header', 'for', { contextAfter: { context: {} } }),
      row('iter0', 'body', { contextAfter: { context: {} }, loopMeta }),
      row('iter1', 'body', { contextAfter: { context: {} }, loopMeta: loopMeta1 }),
      row('after', 'next'),
    ];
    const forkSession = {
      anchorStageId: 'iter1',
      forkSessionId: 'fork-1',
      setups: [
        { stageId: 'iter1', context: {}, loopMeta: loopMeta1, stage: { logic: 'body-edited' } },
        { stageId: 'after', context: {}, stage: { logic: 'next' } },
      ],
      sourceSessionId: 'src',
      targetSessionId: 'tgt',
    };

    const manager = new ForkSessionManager(forkSession, sourceRows);
    const plan = manager.buildExecutionPlan();
    const fastForwardIds = plan
      .filter((step) => step.kind === 'fastForward')
      .map((step) => step.row.stageId);
    const runIds = plan
      .filter((step) => step.kind === 'run')
      .map((step) => step.setup.stageId);

    assert.deepEqual(fastForwardIds, ['header', 'iter0']);
    assert.deepEqual(runIds, ['iter1', 'after']);
  });

  it('last fastForward step is anchor predecessor with contextAfter', () => {
    const sourceRows = [
      row('a', 'a', { contextAfter: { context: { n: 1 } } }),
      row('b', 'b', { contextAfter: { context: { n: 2 } } }),
      row('c', 'c'),
    ];
    const forkSession = {
      anchorStageId: 'c',
      forkSessionId: 'fork-1',
      setups: [{ stageId: 'c', context: {}, stage: { logic: 'c2' } }],
      sourceSessionId: 'src',
      targetSessionId: 'tgt',
    };

    const manager = new ForkSessionManager(forkSession, sourceRows);
    const plan = manager.buildExecutionPlan();
    const lastFastForward = plan.filter((step) => step.kind === 'fastForward').at(-1);

    assert.equal(lastFastForward?.kind, 'fastForward');
    assert.equal(lastFastForward?.kind === 'fastForward' && lastFastForward.row.stageId, 'b');
    assert.ok(manager.contextAfterForPrefixRow(
      lastFastForward?.kind === 'fastForward' ? lastFastForward.row : sourceRows[0]!,
    ));
  });

  it('run steps cover all merged setups without gaps', () => {
    const sourceRows = [
      row('s1', 'a'),
      row('s2', 'b', { loopMeta: { arraySnapshot: [], index: 0, value: 1 } }),
      row('s3', 'c', { loopMeta: { arraySnapshot: [], index: 1, value: 2 } }),
      row('s4', 'd'),
    ];
    const forkSession = {
      anchorStageId: 's2',
      forkSessionId: 'fork-1',
      setups: [
        { stageId: 's2', context: {}, stage: { logic: 'b-edited' } },
        { stageId: 's3', context: {}, stage: { logic: 'c' } },
        { stageId: 's4', context: {}, stage: { logic: 'd-edited' } },
      ],
      sourceSessionId: 'src',
      targetSessionId: 'tgt',
    };

    const manager = new ForkSessionManager(forkSession, sourceRows);
    const runIds = manager.buildExecutionPlan()
      .filter((step) => step.kind === 'run')
      .map((step) => step.setup.stageId);

    assert.deepEqual(runIds, ['s2', 's3', 's4']);
  });

  it('exposes parsedStages from fork session response', () => {
    const forkSession = {
      anchorStageId: 'b',
      forkSessionId: 'fork-1',
      parsedStages: [
        {
          lines: 'a',
          sourceStartLine: 1,
          spec: { logic: 'a' },
          type: 'plain' as const,
        },
      ],
      setups: [{ stageId: 'b', context: {}, stage: { logic: 'b2' } }],
      sourceSessionId: 'src',
      targetSessionId: 'tgt',
    };

    const manager = new ForkSessionManager(forkSession, [row('a', 'a')]);

    assert.equal(manager.parsedStages.length, 1);
    assert.equal(manager.parsedStages[0]?.spec.logic, 'a');
  });

});
