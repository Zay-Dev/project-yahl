import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertSessionBundle, sessionReferencesTaskSkills } from './prepare-task-workspace';

const sessionBundle = {
  parsedStages: [],
  runInput: {},
  sessionId: 'sess-1',
  taskId: 'who_am_i',
  taskSkills: [],
  taskYahl: 'name: who\nstages: []',
};

describe('assertSessionBundle', () => {
  it('passes when taskId and taskYahl are set', () => {
    assert.doesNotThrow(() => assertSessionBundle(sessionBundle));
  });

  it('throws when taskId is blank', () => {
    assert.throws(
      () => assertSessionBundle({ ...sessionBundle, taskId: '   ' }),
      /missing task bundle sessionId=sess-1/,
    );
  });

  it('throws when taskYahl is blank', () => {
    assert.throws(
      () => assertSessionBundle({ ...sessionBundle, taskYahl: '   ' }),
      /missing task bundle sessionId=sess-1/,
    );
  });
});

describe('sessionReferencesTaskSkills', () => {
  it('detects task-skills references in taskYahl', () => {
    assert.equal(
      sessionReferencesTaskSkills({
        parsedStages: [],
        taskId: 'who_am_i',
        taskSkills: [],
        taskYahl: 'logic: ~/task-skills/task-mission/SKILL.md',
      }),
      true,
    );
  });

  it('detects task-skills references in parsedStages lines', () => {
    assert.equal(
      sessionReferencesTaskSkills({
        parsedStages: [{
          lines: 'const x = ~/task-skills/foo/SKILL.md',
          sourceStartLine: 1,
          spec: { logic: 'x' },
          type: 'plain',
        }],
        taskId: 'who_am_i',
        taskSkills: [],
        taskYahl: 'name: plain\nstages: []',
      }),
      true,
    );
  });

  it('returns false when no task-skills references exist', () => {
    assert.equal(
      sessionReferencesTaskSkills({
        parsedStages: [],
        taskId: 'plain',
        taskSkills: [],
        taskYahl: 'name: plain\nstages: []',
      }),
      false,
    );
  });
});
