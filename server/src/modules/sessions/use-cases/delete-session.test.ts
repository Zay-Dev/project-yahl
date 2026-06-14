import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import Joi from 'joi';

const querySchema = Joi.object({
  mode: Joi.string().valid('soft', 'hard').required(),
});

describe('deleteSession query', () => {
  it('accepts soft and hard mode', () => {
    assert.equal(querySchema.validate({ mode: 'soft' }).error, undefined);
    assert.equal(querySchema.validate({ mode: 'hard' }).error, undefined);
  });

  it('rejects missing or invalid mode', () => {
    assert.ok(querySchema.validate({}).error);
    assert.ok(querySchema.validate({ mode: 'archive' }).error);
  });
});
