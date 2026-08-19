import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { deriveTaskIdFromYahlPath, deriveTaskNameFromYahl } from './derive-task-id';

const testSkillPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../server/tasks/test/SKILL.yaml',
);

describe('deriveTaskNameFromYahl', () => {
  it('uses yahl name field when document is valid', () => {
    const yahl = readFileSync(testSkillPath, 'utf-8');

    assert.equal(
      deriveTaskNameFromYahl(yahl, 'server/tasks/test/SKILL.yaml'),
      'test the syntax',
    );
  });

  it('falls back to task folder name for non-yahl text', () => {
    assert.equal(
      deriveTaskNameFromYahl('plain logic only', 'server/tasks/research/SKILL.yaml'),
      'research',
    );
  });

  it('deriveTaskIdFromYahlPath returns folder name for .yaml', () => {
    assert.equal(
      deriveTaskIdFromYahlPath('server/tasks/test/SKILL.yaml'),
      'test',
    );
  });

  it('deriveTaskIdFromYahlPath returns folder name for .yml', () => {
    assert.equal(
      deriveTaskIdFromYahlPath('server/tasks/test/SKILL.yml'),
      'test',
    );
  });
});
