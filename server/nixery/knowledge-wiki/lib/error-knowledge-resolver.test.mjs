import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveErrorWithKnowledge } from './error-knowledge-resolver.mjs';

const observation = {
  topic_hint: 'browser-errors',
  cue: 'structured extraction failed',
  claim: 'the response could not be parsed',
  example: 'extract returned ok:false',
  evidence: { ok: false, tool: 'browser' },
};

const observationGate = {
  ok: true,
  observationId: 'error-a1b2c3d4e5f6',
  path: 'topics/browser-errors/raw/observations/2026-08-09/error-a1b2c3d4e5f6',
  topic: 'browser-errors',
};

const resolve = (overrides = {}) => resolveErrorWithKnowledge({
  buildObservationInput: () => observation,
  input: {
    requestId: 'request-1',
    sessionId: 'session-1',
    tool: 'browser',
  },
  lookupKnowledge: async () => ({
    status: 'not_found',
    solution: null,
    citations: [],
  }),
  resolveObservationIncidentId: () => 'error-a1b2c3d4e5f6',
  submitKnowledgeObservation: async () => ({
    gate: observationGate,
    observation,
    result: { ok: true },
  }),
  validateKnowledgeObservation: () => ({ ok: true, observation }),
  ...overrides,
});

describe('resolveErrorWithKnowledge', () => {
  it('returns a cited found solution', async () => {
    const result = await resolve({
      lookupKnowledge: async () => ({
        status: 'found',
        solution: 'Use a separate extraction call.',
        citations: [{
          path: 'topics/browser-errors/howto',
          excerpt: 'Run extraction after the interaction completes.',
        }],
      }),
    });

    assert.equal(result.status, 'found');
    assert.equal(result.solution, 'Use a separate extraction call.');
    assert.deepEqual(result.observation, observationGate);
    assert.equal(result.citations.length, 1);
  });

  it('returns not_found without writing the failure twice', async () => {
    let submissions = 0;
    const result = await resolve({
      submitKnowledgeObservation: async () => {
        submissions += 1;

        return {
          gate: observationGate,
          observation,
          result: { ok: true },
        };
      },
    });

    assert.equal(result.status, 'not_found');
    assert.equal(result.solution, null);
    assert.equal(submissions, 1);
  });

  it('keeps the observation and returns unavailable when lookup fails', async () => {
    const result = await resolve({
      lookupKnowledge: async () => {
        throw new Error('knowledge export unavailable');
      },
    });

    assert.equal(result.status, 'unavailable');
    assert.equal(result.lookupError, 'knowledge export unavailable');
    assert.deepEqual(result.observation, observationGate);
  });

  it('rejects the newly submitted failure as its own solution citation', async () => {
    const result = await resolve({
      lookupKnowledge: async () => ({
        status: 'found',
        solution: 'Repeat the failed attempt.',
        citations: [{
          path: observationGate.path,
          excerpt: 'The extraction failed.',
        }],
      }),
    });

    assert.equal(result.status, 'unavailable');
    assert.match(result.lookupError, /requires a solution and at least one citation/);
  });

  it('does not search after persistence failure', async () => {
    let lookups = 0;
    const result = await resolve({
      lookupKnowledge: async () => {
        lookups += 1;

        return { status: 'not_found' };
      },
      submitKnowledgeObservation: async () => ({
        gate: { ok: false, error: 'wiki write failed' },
        observation,
        result: { ok: false },
      }),
    });

    assert.deepEqual(result, { ok: false, error: 'wiki write failed' });
    assert.equal(lookups, 0);
  });
});
