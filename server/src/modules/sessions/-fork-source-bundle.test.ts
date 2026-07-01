import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validateForkSourceBundle } from './-fork-source-bundle';

const validSource = {
  parsedStages: [{ lines: 'logic: x', sourceStartLine: 1, type: 'plain' as const }],
  taskId: 'who_am_i',
  taskSkills: [{ content: '# skill', path: 'task-mission/SKILL.md' }],
  taskYahl: 'name: who\nstages: []',
};

describe('validateForkSourceBundle', () => {
  it('returns taskId when bundle is complete', () => {
    assert.equal(validateForkSourceBundle(validSource), 'who_am_i');
  });

  it('rejects missing taskYahl', () => {
    assert.throws(
      () =>
        validateForkSourceBundle({
          ...validSource,
          taskYahl: undefined,
        }),
      /missing taskYahl snapshot/,
    );
  });

  it('rejects blank taskYahl', () => {
    assert.throws(
      () =>
        validateForkSourceBundle({
          ...validSource,
          taskYahl: '   ',
        }),
      /missing taskYahl snapshot/,
    );
  });
});
