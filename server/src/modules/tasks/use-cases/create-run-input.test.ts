import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  parseRunInputKeysFromYahl,
  validateRunInputPayload,
} from '@project-yahl/shared/yahl/run-input-keys';

const knowledgeRefreshPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../server/tasks/knowledge_refresh/SKILL.yahl',
);

describe('create run runInput validation', () => {
  it('reads runInputKeys from knowledge_refresh SKILL.yahl', () => {
    const yahl = readFileSync(knowledgeRefreshPath, 'utf8');
    const keys = parseRunInputKeysFromYahl(yahl);

    assert.deepEqual(keys, ['knowledge_topic', 'rerun_intent', 'additional_instruction']);
  });

  it('accepts declared runInput keys', () => {
    const result = validateRunInputPayload(
      { knowledge_topic: 'hk-weather' },
      ['knowledge_topic', 'rerun_intent', 'additional_instruction'],
    );

    assert.equal(result.ok, true);
  });

  it('accepts additional_instruction string in runInput', () => {
    const result = validateRunInputPayload(
      {
        knowledge_topic: 'hk-weather',
        additional_instruction: 'all, try refresh from discussion https://example.com',
      },
      ['knowledge_topic', 'rerun_intent', 'additional_instruction'],
    );

    assert.equal(result.ok, true);
  });

  it('accepts nested rerun_intent object in runInput', () => {
    const result = validateRunInputPayload(
      {
        knowledge_topic: 'hk-weather',
        rerun_intent: {
          isRerun: true,
          proceedMode: 'update_selected',
          updateScope: ['studies', 'facts'],
          addressOpenQuestions: false,
        },
      },
      ['knowledge_topic', 'rerun_intent', 'additional_instruction'],
    );

    assert.equal(result.ok, true);
  });

  it('rejects unknown runInput keys for keyed tasks', () => {
    const result = validateRunInputPayload(
      { topic: 'hk-weather' },
      ['knowledge_topic'],
    );

    assert.equal(result.ok, false);
  });

  it('rejects runInput for tasks without declared keys', () => {
    const result = validateRunInputPayload({ foo: 'bar' }, undefined);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /does not accept runInput/);
    }
  });
});
