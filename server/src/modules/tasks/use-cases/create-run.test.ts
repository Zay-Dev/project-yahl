import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { taskYahlRelativePath } from '../-tasks-root';

describe('create run task metadata', () => {
  it('uses server/tasks relative path for pending session stub', () => {
    assert.equal(
      taskYahlRelativePath('media_to_text_test'),
      'server/tasks/media_to_text_test/SKILL.yahl',
    );
  });
});
