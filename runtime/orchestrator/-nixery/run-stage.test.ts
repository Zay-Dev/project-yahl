import type { TNixeryDef } from '@project-yahl/shared/nixery/types';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveNixeryRequestId, resolveNixeryRunMaxAttempts } from './run-stage';

const baseDef = (overrides: Partial<TNixeryDef> = {}): TNixeryDef => ({
  id: 'test-def',
  packages: ['nodejs'],
  ...overrides,
});

describe('resolveNixeryRequestId', () => {
  it('prefers params.requestId over input.requestId', () => {
    assert.equal(
      resolveNixeryRequestId({
        input: { requestId: 'from-input' },
        requestId: ' from-params ',
      }),
      'from-params',
    );
  });

  it('falls back to input.requestId when params.requestId is missing', () => {
    assert.equal(
      resolveNixeryRequestId({
        input: { requestId: ' verify-req ' },
      }),
      'verify-req',
    );
  });

  it('returns undefined when neither is set', () => {
    assert.equal(
      resolveNixeryRequestId({ input: {} }),
      undefined,
    );
  });
});

describe('resolveNixeryRunMaxAttempts', () => {
  it('defaults inlineTool defs to 1 attempt', () => {
    assert.equal(
      resolveNixeryRunMaxAttempts(baseDef({ output: { inlineTool: true } })),
      1,
    );
  });

  it('keeps 10 attempts for orchestrator-scheduled defs', () => {
    assert.equal(resolveNixeryRunMaxAttempts(baseDef()), 10);
  });

  it('honors explicit retry on inlineTool defs', () => {
    assert.equal(
      resolveNixeryRunMaxAttempts(baseDef({ output: { inlineTool: true, retry: 5 } })),
      5,
    );
  });
});

