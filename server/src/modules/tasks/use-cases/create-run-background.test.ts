import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseTaskMetadata } from '../-parse-task-metadata';
import { pendingSessionUpdateDoc } from '../../sessions/-pending-session-update';

describe('createRun background flag', () => {
  it('maps task background metadata to pending session isBackground', () => {
    const yahl = `name: knowledge-manager
description: Overnight Knowledge Manager
background: true

stages:
  - logic: |
      (() => ({}))`;
    const task = parseTaskMetadata(yahl);

    assert.equal(task.background, true);

    const update = pendingSessionUpdateDoc({
      isBackground: task.background === true,
      sessionId: 'sess-km',
      taskId: 'knowledge_manager',
      taskYahl: yahl,
    });

    assert.equal(update.$set.isBackground, true);
  });
});
