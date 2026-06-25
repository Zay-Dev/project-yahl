import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseTaskMetadata } from '../-parse-task-metadata';
import { pendingSessionUpdateDoc } from '../../sessions/-pending-session-update';

describe('createRun background flag', () => {
  it('maps task background metadata to pending session isBackground', () => {
    const yahl = `name: knowledge-tidy
description: Tidy knowledges
background: true

stages:
  - logic: |
      (() => ({}))`;
    const task = parseTaskMetadata(yahl);

    assert.equal(task.background, true);

    const update = pendingSessionUpdateDoc({
      isBackground: task.background === true,
      sessionId: 'sess-tidy',
      taskId: 'knowledge_tidy',
      taskYahlPath: 'server/tasks/knowledge_tidy/SKILL.yahl',
    });

    assert.equal(update.$set.isBackground, true);
  });
});
