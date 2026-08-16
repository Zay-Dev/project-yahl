import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatObservationMarkdown,
  observationPagePath,
  validateKnowledgeObservation,
} from './observation.js';

describe('validateKnowledgeObservation', () => {
  it('accepts a complete observed note with example', () => {
    const result = validateKnowledgeObservation({
      kind: 'observation',
      topic_hint: 'traffic-monitor',
      cue: 'form-fill ok:false',
      claim: 'form may still be valid',
      example: 'poll#3 Search clicked then extract succeeded',
      evidence: { tool: 'browser', sessionId: 's1' },
      confidence: 'observed',
      tags: ['HOWTO', 'TRICK'],
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.observation.topic_hint, 'traffic-monitor');
    }
  });

  it('defaults missing topic_hint to inbox', () => {
    const result = validateKnowledgeObservation({
      cue: 'platform tip',
      claim: 'soft hint optional',
      example: 'omitted topic_hint',
      evidence: { tool: 'platform' },
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.observation.topic_hint, 'inbox');
    }
  });

  it('rejects claim without example or quote', () => {
    const result = validateKnowledgeObservation({
      topic_hint: 'traffic-monitor',
      cue: 'x',
      claim: 'y',
      evidence: { tool: 'browser' },
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /example or quote/);
    }
  });
});

describe('observationPagePath', () => {
  it('builds raw observations path', () => {
    assert.match(
      observationPagePath({ id: 'abc', at: new Date('2026-08-04T12:00:00Z') }),
      /^raw\/observations\/2026-08-04\/abc$/,
    );
  });
});

describe('formatObservationMarkdown', () => {
  it('includes claim and example sections', () => {
    const md = formatObservationMarkdown({
      kind: 'observation',
      topic_hint: 'traffic-monitor',
      cue: 'cue',
      claim: 'claim text',
      example: 'example text',
      evidence: { tool: 'browser' },
      confidence: 'observed',
    }, { id: 'o1', submittedAt: '2026-08-04T00:00:00.000Z' });

    assert.match(md, /## Claim/);
    assert.match(md, /## Example/);
    assert.match(md, /claim text/);
  });
});
