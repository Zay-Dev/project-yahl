import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { filterLaterStagesForRerun } from './rerun-later-stages';

describe('filterLaterStagesForRerun', () => {
  it('excludes same-loop siblings when anchor has loopSetup', () => {
    const stages = [
      {
        createdAt: '',
        logicPreview: '',
        loopSetup: 'for each i of [1..2]',
        modelCallCount: 0,
        requestId: 'r1',
        stageId: 's1',
        status: 'finished' as const,
        tokenTotals: null,
        toolCallCount: 0,
        updatedAt: '',
      },
      {
        createdAt: '',
        logicPreview: '',
        loopIndex: 0,
        loopSetup: 'for each i of [1..2]',
        modelCallCount: 0,
        requestId: 'r2',
        stageId: 's2',
        status: 'finished' as const,
        tokenTotals: null,
        toolCallCount: 0,
        updatedAt: '',
      },
      {
        createdAt: '',
        logicPreview: '',
        loopIndex: 1,
        loopSetup: 'for each i of [1..2]',
        modelCallCount: 0,
        requestId: 'r3',
        stageId: 's3',
        status: 'finished' as const,
        tokenTotals: null,
        toolCallCount: 0,
        updatedAt: '',
      },
      {
        createdAt: '',
        logicPreview: '',
        modelCallCount: 0,
        requestId: 'r4',
        stageId: 's4',
        status: 'finished' as const,
        tokenTotals: null,
        toolCallCount: 0,
        updatedAt: '',
      },
    ];

    const later = filterLaterStagesForRerun(stages, stages[1]!);

    assert.deepEqual(later.map((item) => item.stageId), ['s4']);
  });
});
