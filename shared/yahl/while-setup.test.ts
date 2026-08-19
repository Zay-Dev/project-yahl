import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseYahlWhileSetup, persistYahlWhileSetup } from './while-setup';

describe('parseYahlWhileSetup', () => {
  it('treats a string as condition with doAtLeast 1', () => {
    assert.deepEqual(
      parseYahlWhileSetup('context.context.c < 3', 'stage'),
      { condition: 'context.context.c < 3', doAtLeast: 1 },
    );
  });

  it('defaults object doAtLeast to 1', () => {
    assert.deepEqual(
      parseYahlWhileSetup({ condition: 'false' }, 'stage'),
      { condition: 'false', doAtLeast: 1 },
    );
  });

  it('keeps doAtLeast when >= 1', () => {
    assert.deepEqual(
      parseYahlWhileSetup({ condition: 'false', doAtLeast: 2 }, 'stage'),
      { condition: 'false', doAtLeast: 2 },
    );
  });

  it('rejects doAtLeast below 1', () => {
    assert.throws(
      () => parseYahlWhileSetup({ condition: 'true', doAtLeast: 0 }, 'stage'),
      /doAtLeast/,
    );
  });
});

describe('persistYahlWhileSetup', () => {
  it('keeps string shorthand', () => {
    assert.equal(persistYahlWhileSetup(' true ', 'stage'), 'true');
  });

  it('omits default doAtLeast on objects', () => {
    assert.deepEqual(
      persistYahlWhileSetup({ condition: ' false ' }, 'stage'),
      { condition: 'false' },
    );
  });
});
