import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { TPreparedRunInput } from '@/orchestrator/-runners/prepared-run-types';

import {
  REPAIR_MIN_MAX_BASH_CALLS,
  REPAIR_MIN_MAX_TURNS,
} from '@/orchestrator/-repair/repair-helpers';
import { createStorage } from '@/orchestrator/-tools/set_context';
import { runRepairStage, toRepairExecutionStage } from '@/orchestrator/-runners/run-repair-stage';

const plainStage: ParsedStage = {
  lines: 'logic: echo',
  sourceStartLine: 1,
  spec: { logic: 'echo' },
  type: 'plain',
};

const loopStage: ParsedStage = {
  lines: 'for each i of items { logic: body }',
  sourceStartLine: 10,
  spec: { logic: 'body', loopSetup: 'items' },
  type: 'loop',
};

const whileStage: ParsedStage = {
  lines: 'whileSetup: cond { logic: poll }',
  sourceStartLine: 20,
  spec: { logic: 'poll', whileSetup: 'cond' },
  type: 'while',
};

const nestedSubmitWait: ParsedStage = {
  lines: 'logic: submit',
  sourceStartLine: 21,
  spec: { id: 'submit_wait', logic: 'submit', maxBashCalls: 12, maxTurns: 14 },
  type: 'plain',
};

const nestedWhileStage: ParsedStage = {
  lines: 'whileSetup: cond { /* nested yahl */ }',
  nestedStages: [
    nestedSubmitWait,
    {
      lines: 'logic: extract',
      sourceStartLine: 22,
      spec: { id: 'extract', logic: 'extract' },
      type: 'plain',
    },
  ],
  sourceStartLine: 20,
  spec: {
    id: 'monitor',
    logic: { stages: [{ logic: 'submit' }, { logic: 'extract' }] },
    whileSetup: 'cond',
  },
  type: 'while',
};

describe('toRepairExecutionStage', () => {
  it('returns plain stages with repair budget floors', () => {
    const stage = toRepairExecutionStage(plainStage);

    assert.equal(stage.type, 'plain');
    assert.equal(stage.spec.logic, 'echo');
    assert.equal(stage.spec.maxTurns, REPAIR_MIN_MAX_TURNS);
    assert.equal(stage.spec.maxBashCalls, REPAIR_MIN_MAX_BASH_CALLS);
  });

  it('compiles loop and while headers to plain execution stages', () => {
    assert.equal(toRepairExecutionStage(loopStage).type, 'plain');
    assert.equal(toRepairExecutionStage(whileStage).type, 'plain');
    assert.equal(toRepairExecutionStage(loopStage).spec.logic, 'body');
    assert.equal(toRepairExecutionStage(whileStage).spec.logic, 'poll');
  });

  it('uses nestedStages[nestedIndex] for nested while shells and raises budgets', () => {
    const stage = toRepairExecutionStage(nestedWhileStage, 0);

    assert.equal(stage.spec.id, 'submit_wait');
    assert.equal(stage.spec.logic, 'submit');
    assert.equal(stage.spec.maxTurns, REPAIR_MIN_MAX_TURNS);
    assert.equal(stage.spec.maxBashCalls, REPAIR_MIN_MAX_BASH_CALLS);
  });

  it('rejects nested while without nestedIndex', () => {
    assert.throws(
      () => toRepairExecutionStage(nestedWhileStage),
      /nestedIndex/,
    );
  });

  it('rejects out-of-range nestedIndex', () => {
    assert.throws(
      () => toRepairExecutionStage(nestedWhileStage, 9),
      /out of range/,
    );
  });
});

describe('runRepairStage', () => {
  it('invokes runYahl for a plain stage with repairMode', async () => {
    const storage = createStorage();
    const prepared: TPreparedRunInput = {
      cursor: {
        kind: 'repair',
        stageIndex: 0,
      },
      parsedStages: [plainStage],
      resultContextKey: 'result',
      storage,
      systemAppend: 'repair append',
      taskYahl: '',
    };

    let capturedOptions: Record<string, unknown> | undefined;

    await runRepairStage(prepared, async (_yahl, options) => {
      capturedOptions = options as Record<string, unknown>;

      return { storage };
    });

    const stages = capturedOptions?.stages as ParsedStage[];

    assert.equal(stages.length, 1);
    assert.equal(stages[0]?.spec.logic, 'echo');
    assert.equal(stages[0]?.spec.maxTurns, REPAIR_MIN_MAX_TURNS);
    assert.equal(stages[0]?.spec.maxBashCalls, REPAIR_MIN_MAX_BASH_CALLS);
    assert.equal(capturedOptions?.repairMode, true);
    assert.equal(capturedOptions?.startFromStageIndex, 0);
    assert.equal(capturedOptions?.systemAppend, 'repair append');
    assert.equal(capturedOptions?.pipelineStageIndex, 0);
  });

  it('invokes runYahl for a loop slot with loopMeta as a single plain iteration', async () => {
    const storage = createStorage();
    const loopMeta = {
      arraySnapshot: ['a', 'b'],
      index: 1,
      indexName: 'i',
      kind: 'for' as const,
      value: 'b',
    };
    const prepared: TPreparedRunInput = {
      cursor: {
        kind: 'repair',
        loopMeta,
        stageIndex: 0,
      },
      parsedStages: [loopStage],
      resultContextKey: 'result',
      storage,
      systemAppend: 'repair append',
      taskYahl: '',
    };

    let capturedOptions: Record<string, unknown> | undefined;

    await runRepairStage(prepared, async (_yahl, options) => {
      capturedOptions = options as Record<string, unknown>;

      return { storage };
    });

    const stages = capturedOptions?.stages as ParsedStage[];

    assert.equal(stages.length, 1);
    assert.equal(stages[0]?.type, 'plain');
    assert.equal(capturedOptions?.repairMode, true);
    assert.deepEqual(capturedOptions?.loopMeta, loopMeta);
  });

  it('invokes runYahl for a while header without loopMeta as a plain execution stage', async () => {
    const storage = createStorage();
    const prepared: TPreparedRunInput = {
      cursor: {
        kind: 'repair',
        stageIndex: 0,
      },
      parsedStages: [whileStage],
      resultContextKey: 'result',
      storage,
      systemAppend: 'repair append',
      taskYahl: '',
    };

    let capturedOptions: Record<string, unknown> | undefined;

    await runRepairStage(prepared, async (_yahl, options) => {
      capturedOptions = options as Record<string, unknown>;

      return { storage };
    });

    const stages = capturedOptions?.stages as ParsedStage[];

    assert.equal(stages.length, 1);
    assert.equal(stages[0]?.type, 'plain');
    assert.equal(stages[0]?.spec.logic, 'poll');
    assert.equal(capturedOptions?.repairMode, true);
    assert.equal(capturedOptions?.loopMeta, undefined);
  });

  it('invokes runYahl for nested while child via nestedIndex', async () => {
    const storage = createStorage();
    const loopMeta = {
      arraySnapshot: [],
      index: 0,
      kind: 'while' as const,
      value: 0,
    };
    const prepared: TPreparedRunInput = {
      cursor: {
        kind: 'repair',
        loopMeta,
        nestedIndex: 0,
        stageIndex: 0,
      },
      parsedStages: [nestedWhileStage],
      resultContextKey: 'result',
      storage,
      systemAppend: 'repair append',
      taskYahl: '',
    };

    let capturedOptions: Record<string, unknown> | undefined;

    await runRepairStage(prepared, async (_yahl, options) => {
      capturedOptions = options as Record<string, unknown>;

      return { storage };
    });

    const stages = capturedOptions?.stages as ParsedStage[];

    assert.equal(stages.length, 1);
    assert.equal(stages[0]?.spec.id, 'submit_wait');
    assert.equal(stages[0]?.spec.logic, 'submit');
    assert.equal(stages[0]?.spec.maxTurns, REPAIR_MIN_MAX_TURNS);
    assert.equal(stages[0]?.spec.maxBashCalls, REPAIR_MIN_MAX_BASH_CALLS);
    assert.equal(capturedOptions?.repairMode, true);
    assert.deepEqual(capturedOptions?.loopMeta, loopMeta);
  });
});
