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

  it('reads task-local skills only for knowledge_manager', async () => {
    const files = await readTaskSkillsFromDisk('knowledge_manager');
    const paths = files.map((file) => file.path);

    assert.ok(files.some((file) => file.path === 'task-mission/SKILL.md'));
    assert.ok(files.some((file) => file.path === 'analyze-additional-instruction/SKILL.md'));
    assert.ok(!paths.includes('locate-knowledge/SKILL.md'));
    assert.ok(!paths.includes('resolve-errors-with-knowledge/SKILL.md'));
    assert.ok(!paths.includes('worth-persisting-knowledge/SKILL.md'));
  });

  it('does not include nixery catalog skills for traffic_monitor', async () => {
    const files = await readTaskSkillsFromDisk('traffic_monitor');
    const paths = files.map((file) => file.path);

    assert.ok(paths.includes('task-mission/SKILL.md'));
    assert.ok(paths.includes('route-analysis/SKILL.md'));
    assert.ok(!paths.includes('monitor-loop/SKILL.md'));
    assert.ok(!paths.includes('worth-persisting-knowledge/SKILL.md'));
    assert.ok(!paths.includes('resolve-errors-with-knowledge/SKILL.md'));
  });

  it('returns empty list when task skills directory is missing', async () => {
    const files = await readTaskSkillsFromDisk('nonexistent_task_id_xyz');

    assert.equal(files.length, 0);
  });
});
