import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import Joi from 'joi';

import { parsedStageSchema } from './stage-schema';

describe('parsedStageSchema', () => {
  it('accepts a compiled plain stage', () => {
    const result = parsedStageSchema.validate({
      lines: '{ return 1; }',
      sourceStartLine: 5,
      spec: { logic: 'return 1;' },
      type: 'plain',
    });

    assert.equal(result.error, undefined);
  });

  it('rejects missing spec logic', () => {
    const result = parsedStageSchema.validate({
      lines: '{ return 1; }',
      sourceStartLine: 5,
      spec: {},
      type: 'plain',
    });

    assert.ok(result.error);
  });

  it('rejects register body with empty parsedStages array', () => {
    const registerStagesSchema = Joi.array().items(parsedStageSchema).min(1);
    const result = registerStagesSchema.validate([]);

    assert.ok(result.error);
  });
});
