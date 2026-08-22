import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { TPreparedRunInput } from '@/orchestrator/-runners/prepared-run-types';

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

describe('toRepairExecutionStage', () => {
  it('returns plain stages unchanged', () => {
    assert.equal(toRepairExecutionStage(plainStage), plainStage);
  });

  it('compiles loop and while headers to plain execution stages', () => {
    assert.equal(toRepairExecutionStage(loopStage).type, 'plain');
    assert.equal(toRepairExecutionStage(whileStage).type, 'plain');
    assert.equal(toRepairExecutionStage(loopStage).spec.logic, 'body');
    assert.equal(toRepairExecutionStage(whileStage).spec.logic, 'poll');
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

    assert.deepEqual(capturedOptions?.stages, [plainStage]);
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
});
