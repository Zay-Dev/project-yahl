import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { deriveTaskIdFromYahlPath, deriveTaskNameFromYahl } from './derive-task-id';

const testSkillPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'TASKS/test/SKILL.yahl',
);

describe('deriveTaskNameFromYahl', () => {
  it('uses yahl name field when document is valid', () => {
    const yahl = readFileSync(testSkillPath, 'utf-8');

    assert.equal(
      deriveTaskNameFromYahl(yahl, '/orchestrator/TASKS/test/SKILL.yahl'),
      'test the syntax',
    );
  });

  it('falls back to task folder name for non-yahl text', () => {
    assert.equal(
      deriveTaskNameFromYahl('plain logic only', '/orchestrator/TASKS/research/SKILL.yahl'),
      'research',
    );
  });

  it('deriveTaskIdFromYahlPath returns folder name', () => {
    assert.equal(
      deriveTaskIdFromYahlPath('/orchestrator/TASKS/test/SKILL.yahl'),
      'test',
    );
  });
});
