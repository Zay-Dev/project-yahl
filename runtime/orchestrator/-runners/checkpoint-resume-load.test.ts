import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import { resolveResumeYahlStages } from './checkpoint-resume-load';

const taskYahlPath = 'server/tasks/verify_test/SKILL.yahl';

const parsedStages: ParsedStage[] = [
  { lines: 'a', sourceStartLine: 1, spec: { logic: 'a' }, type: 'plain' },
  { lines: 'b', sourceStartLine: 2, spec: { logic: 'b' }, type: 'plain' },
];

describe('resolveResumeYahlStages', () => {
  it('returns parsedStages without reading task file when stages are persisted', async () => {
    let readCalled = false;

    const stages = await resolveResumeYahlStages(
      {
        parsedStages,
        taskYahlPath,
      },
      async () => {
        readCalled = true;

        return [];
      },
    );

    assert.equal(readCalled, false);
    assert.equal(stages, parsedStages);
    assert.equal(stages.length, 2);
  });

  it('falls back to task id from session when parsedStages missing', async () => {
    let resolvedTaskId = '';

    const stages = await resolveResumeYahlStages(
      {
        taskId: 'verify_test',
      },
      async (taskId) => {
        resolvedTaskId = taskId;

        return parsedStages;
      },
    );

    assert.equal(resolvedTaskId, 'verify_test');
    assert.equal(stages, parsedStages);
  });

  it('falls back to task folder derived from stored path when taskId missing', async () => {
    let resolvedTaskId = '';

    const stages = await resolveResumeYahlStages(
      {
        taskYahlPath,
      },
      async (taskId) => {
        resolvedTaskId = taskId;

        return parsedStages;
      },
    );

    assert.equal(resolvedTaskId, 'verify_test');
    assert.equal(stages, parsedStages);
  });

  it('throws when parsedStages, taskId, and taskYahlPath are all missing', async () => {
    await assert.rejects(
      () => resolveResumeYahlStages({}),
      /missing taskId and taskYahlPath/,
    );
  });
});
