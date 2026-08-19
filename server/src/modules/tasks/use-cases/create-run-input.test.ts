import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  parseRunInputKeysFromYahl,
  validateRunInputPayload,
} from '@project-yahl/shared/yahl/run-input-keys';

const knowledgeManagerPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../server/tasks/knowledge_manager/SKILL.yaml',
);

describe('create run runInput validation', () => {
  it('reads runInputKeys from knowledge_manager SKILL.yaml', () => {
    const yahl = readFileSync(knowledgeManagerPath, 'utf8');
    const keys = parseRunInputKeysFromYahl(yahl);

    assert.deepEqual(keys, ['additional_instruction']);
  });

  it('accepts declared runInput keys', () => {
    const result = validateRunInputPayload(
      { additional_instruction: 'focus on hk-weather tonight' },
      ['additional_instruction'],
    );

    assert.equal(result.ok, true);
  });

  it('accepts additional_instruction string in runInput', () => {
    const result = validateRunInputPayload(
      {
        additional_instruction: 'all, try refresh from discussion https://example.com',
      },
      ['additional_instruction'],
    );

    assert.equal(result.ok, true);
  });

  it('rejects unknown runInput keys for keyed tasks', () => {
    const result = validateRunInputPayload(
      { topic: 'hk-weather' },
      ['additional_instruction'],
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
