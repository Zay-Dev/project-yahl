import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sessionReferencesTaskSkills } from './session-references-task-skills';

describe('sessionReferencesTaskSkills', () => {
  it('detects task-skills references in taskYahl', () => {
    assert.equal(
      sessionReferencesTaskSkills({
        parsedStages: [],
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
        }],
        taskYahl: 'name: plain\nstages: []',
      }),
      true,
    );
  });

  it('returns false when no task-skills references exist', () => {
    assert.equal(
      sessionReferencesTaskSkills({
        parsedStages: [],
        taskYahl: 'name: plain\nstages: []',
      }),
      false,
    );
  });
});
