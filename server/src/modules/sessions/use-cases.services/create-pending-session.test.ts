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
});
