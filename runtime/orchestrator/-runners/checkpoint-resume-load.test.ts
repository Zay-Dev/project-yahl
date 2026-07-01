import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import { resolveResumeYahlStages } from './checkpoint-resume-load';

const parsedStages: ParsedStage[] = [
  { lines: 'a', sourceStartLine: 1, spec: { logic: 'a' }, type: 'plain' },
  { lines: 'b', sourceStartLine: 2, spec: { logic: 'b' }, type: 'plain' },
];

describe('resolveResumeYahlStages', () => {
  it('returns parsedStages when stages are persisted', () => {
    const stages = resolveResumeYahlStages({ parsedStages });

    assert.equal(stages, parsedStages);
    assert.equal(stages.length, 2);
  });

  it('throws when parsedStages is empty', () => {
    assert.throws(
      () => resolveResumeYahlStages({ parsedStages: [] }),
      /missing parsedStages/,
    );
  });
});
