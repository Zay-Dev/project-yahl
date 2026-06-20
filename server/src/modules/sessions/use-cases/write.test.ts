import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import Joi from 'joi';

const patchBodySchema = Joi.object({
  liveViewVncPort: Joi.number().integer().min(1).max(65535).allow(null).optional(),
  result: Joi.any().optional(),
});

const isLiveViewPortOnlyPatch = (body: {
  liveViewVncPort?: number | null;
  result?: unknown;
}) => 'liveViewVncPort' in body && !('result' in body);

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
});
