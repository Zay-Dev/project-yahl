import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildObservationInput } from './build-observation-input.mjs';

describe('buildObservationInput', () => {
  it('wraps string evidence as { note, sessionId }', () => {
    const result = buildObservationInput({
      topic: 'traffic-monitor',
      cue: 'poi bind',
      claim: 'estate binds to estate POI',
      example: 'Hen On Estate → Ma On Shan estate POI',
      evidence: 'Durable cache traffic_source.md for HKeMobility',
      sessionId: 'sess-1',
    });

    assert.deepEqual(result.evidence, {
      note: 'Durable cache traffic_source.md for HKeMobility',
      sessionId: 'sess-1',
    });
  });

  it('keeps object evidence unchanged', () => {
    const evidence = { type: 'tool_observation', tool: 'browser' };
    const result = buildObservationInput({
      topic_hint: 'traffic-monitor',
      cue: 'x',
      claim: 'y',
      example: 'z',
      evidence,
      sessionId: 'sess-1',
    });

    assert.equal(result.evidence, evidence);
  });

  it('falls back to { sessionId } when evidence is missing', () => {
    const result = buildObservationInput({
      topic: 'traffic-monitor',
      cue: 'x',
      claim: 'y',
      example: 'z',
      sessionId: 'sess-2',
    });

    assert.deepEqual(result.evidence, { sessionId: 'sess-2' });
  });

  it('prefers nested object observation over flat fields', () => {
    const nested = {
      kind: 'observation',
      topic_hint: 'nested-topic',
      cue: 'nested cue',
      claim: 'nested claim',
      example: 'nested example',
      evidence: { tool: 'browser' },
    };

    const result = buildObservationInput({
      observation: nested,
      topic: 'flat-topic',
      cue: 'flat cue',
      claim: 'flat claim',
      example: 'flat example',
      evidence: 'ignored prose',
      sessionId: 'sess-3',
    });

    assert.equal(result, nested);
  });

  it('folds prose observation into example when example and quote are absent', () => {
    const result = buildObservationInput({
      topic: 'traffic-monitor',
      cue: 'x',
      claim: 'y',
      observation: 'This-run OD origin Hen On Estate',
      evidence: { tool: 'browser' },
      sessionId: 'sess-4',
    });

    assert.equal(result.example, 'This-run OD origin Hen On Estate');
  });

  it('does not overwrite an existing example with prose observation', () => {
    const result = buildObservationInput({
      topic: 'traffic-monitor',
      cue: 'x',
      claim: 'y',
      observation: 'ignored prose observation',
      example: 'keep this example',
      evidence: { tool: 'browser' },
      sessionId: 'sess-5',
    });

    assert.equal(result.example, 'keep this example');
  });
});
