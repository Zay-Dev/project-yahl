import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import Joi from 'joi';

const patchBodySchema = Joi.object({
  lastError: Joi.object({
    at: Joi.string().isoDate().required(),
    code: Joi.string().valid('budget_burnout', 'stage_failed').required(),
    message: Joi.string().trim().min(1).required(),
    requestId: Joi.string().trim().optional(),
    stageId: Joi.string().trim().optional(),
    stageIndex: Joi.number().integer().min(0).optional(),
  }).optional(),
  liveViewVncPort: Joi.number().integer().min(1).max(65535).allow(null).optional(),
  result: Joi.any().optional(),
  runCursor: Joi.object({
    kind: Joi.string().valid('pipeline', 'repair').required(),
    stageIndex: Joi.number().integer().min(0).required(),
  }).optional(),
});

const isLiveViewPortOnlyPatch = (body: {
  lastError?: unknown;
  liveViewVncPort?: number | null;
  result?: unknown;
  runCursor?: unknown;
}) =>
  'liveViewVncPort' in body
  && !('result' in body)
  && !('runCursor' in body)
  && !('lastError' in body);

describe('patchSession liveViewVncPort', () => {
  it('accepts liveViewVncPort-only patch body', () => {
    const body = { liveViewVncPort: 5901 };

    assert.equal(patchBodySchema.validate(body).error, undefined);
    assert.equal(isLiveViewPortOnlyPatch(body), true);
  });

  it('accepts clearing liveViewVncPort with null', () => {
    const body = { liveViewVncPort: null };

    assert.equal(patchBodySchema.validate(body).error, undefined);
    assert.equal(isLiveViewPortOnlyPatch(body), true);
  });

  it('treats result patches as not live-view-only', () => {
    const body = { liveViewVncPort: 5901, result: { ok: true } };

    assert.equal(isLiveViewPortOnlyPatch(body), false);
  });

  it('accepts lastError patch body and treats it as not live-view-only', () => {
    const body = {
      lastError: {
        at: '2026-08-29T19:39:41.215Z',
        code: 'budget_burnout' as const,
        message: 'stage maxTurns exhausted (12)',
        stageId: 'notify_and_sleep',
        stageIndex: 10,
      },
    };

    assert.equal(patchBodySchema.validate(body).error, undefined);
    assert.equal(isLiveViewPortOnlyPatch(body), false);
  });
});
