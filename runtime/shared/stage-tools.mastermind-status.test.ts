import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseMastermindStatusToolArguments } from './stage-tools.js';

describe('stage-tools mastermind_status', () => {
  it('parses optional invocationId', () => {
    assert.deepEqual(parseMastermindStatusToolArguments('{}'), {});
    assert.deepEqual(
      parseMastermindStatusToolArguments('{"invocationId":"inv-1"}'),
      { invocationId: 'inv-1' },
    );
  });

  it('returns empty object for invalid json', () => {
    assert.deepEqual(parseMastermindStatusToolArguments('not-json'), {});
  });
});
