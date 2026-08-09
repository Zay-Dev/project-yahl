import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readTaskSkillsFromDisk } from './-read-task-skills';

describe('readTaskSkillsFromDisk', () => {
  it('reads who_am_i task skills with posix-relative paths', async () => {
    const files = await readTaskSkillsFromDisk('who_am_i');

    const paths = files.map((file) => file.path);

    assert.ok(files.length >= 2);
    assert.ok(files.some((file) => file.path === 'task-mission/SKILL.md'));
    assert.ok(files.every((file) => !file.path.includes('\\')));
    assert.deepEqual(paths, [...paths].sort((left, right) => left.localeCompare(right)));
  });

  it('merges shared skills and prefers task-local overrides', async () => {
    const files = await readTaskSkillsFromDisk('knowledge_manager');

    assert.ok(files.some((file) => file.path === 'locate-knowledge/SKILL.md'));
    assert.ok(files.some((file) => file.path === 'task-mission/SKILL.md'));
    assert.ok(files.some((file) => file.path === 'analyze-additional-instruction/SKILL.md'));
    assert.ok(files.some((file) => file.path === 'resolve-errors-with-knowledge/SKILL.md'));
    assert.ok(files.some((file) => file.path === 'worth-persisting-knowledge/SKILL.md'));
  });

  it('returns shared skills when task skills directory is missing', async () => {
    const files = await readTaskSkillsFromDisk('nonexistent_task_id_xyz');

    assert.ok(files.some((file) => file.path === 'locate-knowledge/SKILL.md'));
    assert.ok(!files.some((file) => file.path === 'task-mission/SKILL.md'));
  });
});
