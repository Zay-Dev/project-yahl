import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveVerifyBannerState } from '@/pages/sessions/hooks/resolve-verify-banner';

const checkpoint = (requestId: string, score = 0.72) => ({
  feedback: 'topics not string[]',
  kind: 'verify' as const,
  parsedStageSnapshot: {
    lines: '{}',
    sourceStartLine: 1,
    type: 'plain' as const,
  },
  requestId,
  score,
  stage: { logic: 'const x = 1;', verify: { defId: 'stage-verify' } },
  status: 'pending' as const,
  storageSnapshot: { context: {} },
  verifyId: `verify-${requestId}`,
});

const stage = (requestId: string, status: 'finished' | 'running' | 'verifying') => ({
  createdAt: '2026-06-21T12:00:00.000Z',
  lastModelDurationMs: 0,
  logicPreview: 'logic',
  modelCallCount: 1,
  modelDurationMs: 0,
  requestId,
  stageId: requestId,
  status,
  domains: [],
  tokenTotals: null,
  toolCallCount: 0,
  updatedAt: '2026-06-21T12:00:00.000Z',
});

describe('resolveVerifyBannerState', () => {
  it('shows auto-retry when checkpoint matches the running stage', () => {
    const state = resolveVerifyBannerState(
      [checkpoint('req-3')],
      [stage('req-3', 'running')],
      { liveViewVncPort: 5901 },
    );

    assert.equal(state?.mode, 'auto_retry');
    assert.equal(state?.checkpoint.requestId, 'req-3');
  });

  it('hides stale checkpoints for finished stages', () => {
    const state = resolveVerifyBannerState(
      [checkpoint('req-3')],
      [stage('req-3', 'finished'), stage('req-5', 'running')],
      { liveViewVncPort: null },
    );

    assert.equal(state, null);
  });

  it('shows manual resume when stage is open but agent is idle', () => {
    const state = resolveVerifyBannerState(
      [checkpoint('req-5')],
      [stage('req-5', 'running')],
      { liveViewVncPort: null },
    );

    assert.equal(state?.mode, 'manual');
  });

  it('hides manual resume while agent is active on a different open stage', () => {
    const state = resolveVerifyBannerState(
      [checkpoint('req-3')],
      [stage('req-3', 'finished'), stage('req-5', 'running')],
      { liveViewVncPort: 5901 },
    );

    assert.equal(state, null);
  });

  it('shows infra_busy for verification infrastructure feedback even when agent is active', () => {
    const state = resolveVerifyBannerState(
      [{
        ...checkpoint('req-3', 0),
        feedback: 'Agent agent-abc already has active run',
      }],
      [stage('req-3', 'running')],
      { liveViewVncPort: 5901 },
    );

    assert.equal(state?.mode, 'infra_busy');
    assert.equal(state?.checkpoint.requestId, 'req-3');
  });

  it('hides banner while stage is verifying', () => {
    const state = resolveVerifyBannerState(
      [checkpoint('req-3')],
      [stage('req-3', 'verifying')],
      { liveViewVncPort: 5901 },
    );

    assert.equal(state, null);
  });

  it('shows infra_busy when checkpoint unavailable flag is set', () => {
    const state = resolveVerifyBannerState(
      [{
        ...checkpoint('req-3', 0),
        feedback: 'verification service unavailable',
        unavailable: true,
      }],
      [stage('req-3', 'running')],
      { liveViewVncPort: 5901 },
    );

    assert.equal(state?.mode, 'infra_busy');
  });
});
