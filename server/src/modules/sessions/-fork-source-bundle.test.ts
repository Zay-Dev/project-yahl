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

  it('allows empty taskSkills when task does not reference ~/task-skills/', () => {
    assert.equal(
      validateForkSourceBundle({
        parsedStages: [{ lines: 'const base = { a: 1 };' }],
        taskId: 'test',
        taskSkills: [],
        taskYahl: 'name: test\nstages: []',
      }),
      'test',
    );
  });

  it('rejects empty taskSkills when task references ~/task-skills/', () => {
    assert.throws(
      () =>
        validateForkSourceBundle({
          ...validSource,
          taskSkills: [],
          taskYahl: 'logic: ~/task-skills/task-mission/SKILL.md',
        }),
      /references ~\/task-skills\/ but has no taskSkills snapshot/,
    );
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
