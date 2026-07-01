import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveSessionRunStateFromSignals } from './-session-run-state-signals';

describe('resolveSessionRunStateFromSignals', () => {
  it('returns idle when all stages are finished', () => {
    assert.equal(
      resolveSessionRunStateFromSignals({
        agentActive: false,
        orchestratorActive: false,
        stages: [{ finishedAt: '2026-06-28T09:00:00.000Z' }],
      }),
      'idle',
    );
  });

  it('returns active when agent or orchestrator is running', () => {
    assert.equal(
      resolveSessionRunStateFromSignals({
        agentActive: true,
        orchestratorActive: false,
        stages: [{ finishedAt: null }],
      }),
      'active',
    );
  });

  it('returns stuck when a stage is open and no runtime is active', () => {
    assert.equal(
      resolveSessionRunStateFromSignals({
        agentActive: false,
        orchestratorActive: false,
        stages: [
          { finishedAt: '2026-06-28T09:00:00.000Z' },
          { finishedAt: null },
        ],
      }),
      'stuck',
    );
  });
});
