import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pendingSessionUpdateDoc } from '../-pending-session-update';

describe('pendingSessionUpdateDoc', () => {
  it('sets task metadata without parsedStages', () => {
    const now = new Date('2026-06-21T00:00:00.000Z');
    const update = pendingSessionUpdateDoc({
      sessionId: 'sess-1',
      taskId: 'media_to_text_test',
      taskYahlPath: 'server/tasks/media_to_text_test/SKILL.yahl',
    }, now);

    assert.deepEqual(update, {
      $set: {
        isBackground: false,
        taskId: 'media_to_text_test',
        taskYahlPath: 'server/tasks/media_to_text_test/SKILL.yahl',
        updatedAt: now,
      },
      $setOnInsert: {
        sessionId: 'sess-1',
      },
    });
    assert.equal('parsedStages' in update.$set, false);
  });

  it('sets isBackground when task is background', () => {
    const update = pendingSessionUpdateDoc({
      isBackground: true,
      sessionId: 'sess-bg',
      taskId: 'knowledge_tidy',
      taskYahlPath: 'server/tasks/knowledge_tidy/SKILL.yahl',
    });

    assert.equal(update.$set.isBackground, true);
  });
});
