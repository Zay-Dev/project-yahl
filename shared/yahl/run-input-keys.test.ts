import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  parseRunInputContextKeys,
  parseRunInputKeysFromYahl,
  validateRunInputPayload,
} from './run-input-keys';

describe('parseRunInputContextKeys', () => {
  it('parses non-empty string array', () => {
    assert.deepEqual(parseRunInputContextKeys(['knowledge_topic']), ['knowledge_topic']);
  });

  it('returns undefined for empty array', () => {
    assert.equal(parseRunInputContextKeys([]), undefined);
  });

  it('rejects duplicate keys', () => {
    assert.throws(
      () => parseRunInputContextKeys(['a', 'a']),
      /duplicate key/,
    );
  });
});

describe('parseRunInputKeysFromYahl', () => {
  it('reads runInput from task yaml', () => {
    const keys = parseRunInputKeysFromYahl(`
name: x
description: y
runInput:
  - knowledge_topic
stages:
  - logic: "x = 1;"
`);

    assert.deepEqual(keys, ['knowledge_topic']);
  });
});

describe('validateRunInputPayload', () => {
  it('rejects runInput when task declares no keys', () => {
    const result = validateRunInputPayload({ foo: 'bar' }, undefined);

    assert.equal(result.ok, false);
  });

  it('rejects unknown keys', () => {
    const result = validateRunInputPayload({ topic: 'x' }, ['knowledge_topic']);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /Unknown runInput keys/);
    }
  });

  it('allows declared keys and missing keys', () => {
    assert.deepEqual(
      validateRunInputPayload({ knowledge_topic: 'slug' }, ['knowledge_topic']),
      { ok: true },
    );
    assert.deepEqual(validateRunInputPayload(undefined, ['knowledge_topic']), { ok: true });
  });
});
