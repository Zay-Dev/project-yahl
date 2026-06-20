import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import { resolveResumeYahlStages } from './checkpoint-resume-load';

const hostTaskYahlPath = '/Users/zay.lau/Documents/Gits/Omniflex/project-yahl/runtime/orchestrator/TASKS/verify_test/SKILL.yahl';

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
        taskYahlPath: hostTaskYahlPath,
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

  it('falls back to task folder derived from stored host path when parsedStages missing', async () => {
    let resolvedFolder = '';

    const stages = await resolveResumeYahlStages(
      {
        taskYahlPath: hostTaskYahlPath,
      },
      async (taskFolder) => {
        resolvedFolder = taskFolder;

        return parsedStages;
      },
    );

    assert.equal(resolvedFolder, 'verify_test');
    assert.equal(stages, parsedStages);
  });

  it('throws when parsedStages and taskYahlPath are both missing', async () => {
    await assert.rejects(
      () => resolveResumeYahlStages({}),
      /missing parsedStages and taskYahlPath/,
    );
  });
});
