import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyRunInputDefaults,
  parseRunInputContextKeys,
  parseRunInputFields,
  parseRunInputKeysFromYahl,
  validateRunInputPayload,
} from './run-input-keys';

describe('parseRunInputFields', () => {
  it('parses string shorthand as text fields', () => {
    assert.deepEqual(parseRunInputFields(['knowledge_topic']), [
      { key: 'knowledge_topic', type: 'text' },
    ]);
  });

  it('parses typed field objects', () => {
    assert.deepEqual(
      parseRunInputFields([
        { key: 'source_instruction', type: 'textarea' },
        {
          default: 'Hong Kong',
          key: 'city',
          options: ['Hong Kong', 'Singapore'],
          type: 'enum',
        },
        { default: '60', key: 'monitor_minutes', type: 'text' },
      ]),
      [
        { key: 'source_instruction', type: 'textarea' },
        {
          default: 'Hong Kong',
          key: 'city',
          options: ['Hong Kong', 'Singapore'],
          type: 'enum',
        },
        { default: '60', key: 'monitor_minutes', type: 'text' },
      ],
    );
  });

  it('returns undefined for empty array', () => {
    assert.equal(parseRunInputFields([]), undefined);
  });

  it('rejects duplicate keys', () => {
    assert.throws(
      () => parseRunInputFields(['a', 'a']),
      /duplicate key/,
    );
  });

  it('rejects enum without options', () => {
    assert.throws(
      () => parseRunInputFields([{ key: 'city', type: 'enum' }]),
      /options/,
    );
  });

  it('rejects enum default outside options', () => {
    assert.throws(
      () => parseRunInputFields([{
        default: 'Tokyo',
        key: 'city',
        options: ['Hong Kong'],
        type: 'enum',
      }]),
      /must be one of options/,
    );
  });
});

describe('parseRunInputContextKeys', () => {
  it('derives keys from fields', () => {
    assert.deepEqual(parseRunInputContextKeys(['knowledge_topic']), ['knowledge_topic']);
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

  it('reads typed runInput objects from task yaml', () => {
    const keys = parseRunInputKeysFromYahl(`
name: x
description: y
runInput:
  - key: source_instruction
    type: textarea
  - key: city
    type: enum
    options:
      - Hong Kong
    default: Hong Kong
stages:
  - logic: "x = 1;"
`);

    assert.deepEqual(keys, ['source_instruction', 'city']);
  });
});

describe('applyRunInputDefaults', () => {
  it('fills missing and blank keys from field defaults', () => {
    assert.deepEqual(
      applyRunInputDefaults(
        { monitor_minutes: '', city: 'Singapore' },
        [
          { default: '60', key: 'monitor_minutes', type: 'text' },
          { default: 'Hong Kong', key: 'city', type: 'text' },
          { default: 'Asia/Hong_Kong', key: 'timezone', type: 'text' },
        ],
      ),
      {
        city: 'Singapore',
        monitor_minutes: '60',
        timezone: 'Asia/Hong_Kong',
      },
    );
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

  it('rejects enum values outside options', () => {
    const result = validateRunInputPayload(
      { city: 'Tokyo' },
      [{
        key: 'city',
        options: ['Hong Kong', 'Singapore'],
        type: 'enum',
      }],
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /must be one of/);
    }
  });

  it('accepts enum values in options', () => {
    assert.deepEqual(
      validateRunInputPayload(
        { city: 'Singapore' },
        [{
          key: 'city',
          options: ['Hong Kong', 'Singapore'],
          type: 'enum',
        }],
      ),
      { ok: true },
    );
  });
});
