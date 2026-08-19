import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import Joi from 'joi';

import { parsedStageSchema, parsedStageSnapshotSchema } from './stage-schema';

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

  it('accepts object whileSetup with doAtLeast', () => {
    const result = parsedStageSchema.validate({
      lines: '{ c += 1; }',
      sourceStartLine: 12,
      spec: {
        logic: 'c += 1;',
        whileSetup: {
          condition: 'false',
          doAtLeast: 2,
        },
      },
      type: 'while',
    });

    assert.equal(result.error, undefined);
  });

  it('rejects register body with empty parsedStages array', () => {
    const registerStagesSchema = Joi.array().items(parsedStageSchema).min(1);
    const result = registerStagesSchema.validate([]);

    assert.ok(result.error);
  });
});

describe('parsedStageSnapshotSchema', () => {
  it('accepts a while parsedStageSnapshot for verify checkpoints', () => {
    const result = parsedStageSnapshotSchema.validate({
      lines: 'whileSetup: "true"\nlogic: "c += 1;"',
      sourceStartLine: 12,
      type: 'while',
    });

    assert.equal(result.error, undefined);
  });
});
