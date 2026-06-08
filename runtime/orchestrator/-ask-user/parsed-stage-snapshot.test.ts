import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ParsedStage } from '@/orchestrator/orchestrator-types';

import { parsedStageFromSnapshot, toParsedStageSnapshot } from './parsed-stage-snapshot';

const sampleStage = (): ParsedStage => ({
  lines: '{\nc += /ask-user(1);\n}',
  sourceStartLine: 12,
  spec: {
    askUser: [{ id: '1', question: 'pick' }],
    logic: 'c += /ask-user(1);',
  },
  type: 'plain',
});

describe('parsed-stage-snapshot', () => {
  it('round-trips parsed stage envelope fields', () => {
    const stage = sampleStage();
    const snapshot = toParsedStageSnapshot(stage);
    const restored = parsedStageFromSnapshot(stage.spec, snapshot);

    assert.equal(restored.lines, stage.lines);
    assert.equal(restored.sourceStartLine, stage.sourceStartLine);
    assert.equal(restored.type, stage.type);
    assert.deepEqual(restored.spec, stage.spec);
  });

  it('preserves edited fork logic in snapshot lines', () => {
    const edited = {
      ...sampleStage(),
      lines: '{\nresult = totally_rewritten();\n}',
      spec: {
        askUser: [{ id: '1', question: 'edited question' }],
        logic: 'result = totally_rewritten();',
      },
    };

    const snapshot = toParsedStageSnapshot(edited);

    assert.match(snapshot.lines, /totally_rewritten/);
    assert.equal(parsedStageFromSnapshot(edited.spec, snapshot).lines, edited.lines);
  });
});
