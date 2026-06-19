import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { JSON_BODY_LIMIT } from '@/middleware/json-body';

describe('json body middleware config', () => {
  it('defaults to a large session payload limit', () => {
    assert.equal(JSON_BODY_LIMIT, '20mb');
  });
});
