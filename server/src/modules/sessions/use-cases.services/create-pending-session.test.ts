import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pendingSessionUpdateDoc } from '../-pending-session-update';

describe('pendingSessionUpdateDoc', () => {
  it('sets task metadata with default empty taskSkills and runInput', () => {
    const now = new Date('2026-06-21T00:00:00.000Z');
    const update = pendingSessionUpdateDoc({
      sessionId: 'sess-1',
      taskId: 'verify_test',
      taskYahl: 'name: verify\nstages: []',
    }, now);

    assert.deepEqual(update, {
      $set: {
        browser: false,
        isBackground: false,
        runInput: {},
        taskId: 'verify_test',
        taskSkills: [],
        taskYahl: 'name: verify\nstages: []',
        updatedAt: now,
      },
      $setOnInsert: {
        sessionId: 'sess-1',
      },
    });
    assert.equal('parsedStages' in update.$set, false);
  });

  it('sets task bundle fields when provided', () => {
    const now = new Date('2026-06-21T00:00:00.000Z');
    const update = pendingSessionUpdateDoc({
      sessionId: 'sess-2',
      taskId: 'who_am_i',
      taskSkills: [{ content: '# mission', path: 'task-mission/SKILL.md' }],
      taskYahl: 'name: who\nstages: []',
    }, now);

    assert.deepEqual(update.$set.taskYahl, 'name: who\nstages: []');
    assert.equal(update.$set.taskSkills?.length, 1);
  });

  it('sets isBackground when task is background', () => {
    const update = pendingSessionUpdateDoc({
      isBackground: true,
      sessionId: 'sess-bg',
      taskId: 'knowledge_manager',
      taskYahl: 'name: km\nstages: []',
    });

    assert.equal(update.$set.isBackground, true);
  });

  it('sets browser when task needs browser sidecar', () => {
    const update = pendingSessionUpdateDoc({
      browser: true,
      sessionId: 'sess-br',
      taskId: 'browser_smoke',
      taskYahl: 'name: smoke\nstages: []',
    });

    assert.equal(update.$set.browser, true);
  });
});
