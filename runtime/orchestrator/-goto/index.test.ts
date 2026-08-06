import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createStorage } from '@/orchestrator/-tools/set_context';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import {
  applyStageGotoContext,
  buildGotoSystemAppend,
  buildStageIdIndexMap,
  clearStageGotoContext,
  handleGotoStageToolCall,
} from './index';

const stage = (overrides: Partial<ParsedStage['spec']> & { logic?: string } = {}): ParsedStage => ({
  lines: overrides.logic ?? 'const x = 1;',
  sourceStartLine: 1,
  spec: {
    logic: overrides.logic ?? 'const x = 1;',
    ...overrides,
  },
  type: 'plain',
});

describe('buildStageIdIndexMap', () => {
  it('maps authoring ids to parsed indices', () => {
    const stages = [
      stage({ id: 'explorer' }),
      stage(),
      stage({ id: 'monitor' }),
    ];
    const map = buildStageIdIndexMap(stages);

    assert.equal(map.get('explorer'), 0);
    assert.equal(map.get('monitor'), 2);
  });
});

describe('handleGotoStageToolCall', () => {
  const stages = [
    stage({ id: 'explorer' }),
    stage({
      goto: [{ command: '/stage(explorer)', description: 'dead source' }],
      id: 'monitor',
    }),
  ];

  it('transfers when target is declared', () => {
    const storage = createStorage();
    const result = handleGotoStageToolCall({
      currentParsedStageIndex: 1,
      gotoCount: 0,
      stages,
      stage: stages[1]!,
      storage,
      toolCall: {
        function: {
          arguments: JSON.stringify({ reason: 'cache gone', stageId: 'explorer' }),
          name: 'goto_stage',
        },
        id: '1',
        type: 'function',
      },
    });

    assert.equal(result.hasError, false);
    assert.equal(result.transfer?.targetStageIndex, 0);
    assert.equal(storage.context.get('stage_goto_reason'), 'cache gone');
    assert.equal(storage.context.get('stage_goto_from'), 'monitor');
  });

  it('rejects undeclared target', () => {
    const storage = createStorage();
    const result = handleGotoStageToolCall({
      currentParsedStageIndex: 1,
      gotoCount: 0,
      stages,
      stage: stages[1]!,
      storage,
      toolCall: {
        function: {
          arguments: JSON.stringify({ reason: 'x', stageId: 'other' }),
          name: 'goto_stage',
        },
        id: '1',
        type: 'function',
      },
    });

    assert.equal(result.hasError, true);
    assert.match(result.result, /not in this stage/);
  });

  it('rejects when max gotos exceeded', () => {
    const storage = createStorage();
    const result = handleGotoStageToolCall({
      currentParsedStageIndex: 1,
      gotoCount: 5,
      stages,
      stage: stages[1]!,
      storage,
      toolCall: {
        function: {
          arguments: JSON.stringify({ reason: 'x', stageId: 'explorer' }),
          name: 'goto_stage',
        },
        id: '1',
        type: 'function',
      },
    });

    assert.equal(result.hasError, true);
    assert.match(result.result, /max transfers/);
  });
});

describe('goto context lifecycle', () => {
  it('clears reason keys', () => {
    const storage = createStorage();

    applyStageGotoContext(storage, {
      fromLabel: 'monitor',
      reason: 'dead',
      stageId: 'explorer',
      targetStageIndex: 0,
    });
    clearStageGotoContext(storage);

    assert.equal(storage.context.get('stage_goto_reason'), undefined);
    assert.equal(storage.context.get('stage_goto_from'), undefined);
  });

  it('builds system append for declared goto', () => {
    const append = buildGotoSystemAppend(stage({
      goto: [{ command: '/stage(explorer)', description: 'when dead' }],
    }));

    assert.match(String(append), /\/stage\(explorer\)/);
    assert.match(String(append), /when dead/);
  });
});
