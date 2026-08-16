import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSubmitKnowledgeObservation } from './submit-observation-core.mjs';

const observation = {
  kind: 'observation',
  topic_hint: 'browser-errors',
  cue: 'browser parse failed',
  claim: 'the structured extraction could not parse the response',
  example: 'extract returned ok:false',
  evidence: { ok: false, tool: 'browser' },
  confidence: 'observed',
};

describe('createSubmitKnowledgeObservation', () => {
  it('reuses one observation id and path for the same incident', async () => {
    const writes = [];
    const submit = createSubmitKnowledgeObservation({
      formatObservationMarkdown: (_, metadata) => JSON.stringify(metadata),
      now: () => new Date('2026-08-09T10:00:00.000Z'),
      observationPagePath: ({ id }) => `raw/observations/2026-08-09/${id}`,
      runUpsertKnowledgePage: async (input) => {
        writes.push(input);

        return {
          ok: true,
          wikiPath: `en/topics/browser-errors/${input.page}`,
        };
      },
      validateKnowledgeObservation: () => ({ ok: true, observation }),
    });
    const input = {
      ...observation,
      tool: 'browser',
      sessionId: 'session-1',
      requestId: 'request-1',
    };
    const first = await submit({ incidentId: 'error-a1b2c3d4e5f6', input });
    const second = await submit({ incidentId: 'error-a1b2c3d4e5f6', input });

    assert.equal(first.gate.observationId, second.gate.observationId);
    assert.equal(first.gate.path, second.gate.path);
    assert.equal(writes[0].page, writes[1].page);
    assert.ok(writes.every((write) => write.mode === 'replace'));
  });

  it('does not write when observation validation fails', async () => {
    let writes = 0;
    const submit = createSubmitKnowledgeObservation({
      formatObservationMarkdown: () => '',
      observationPagePath: () => '',
      runUpsertKnowledgePage: async () => {
        writes += 1;

        return { ok: true };
      },
      validateKnowledgeObservation: () => ({
        ok: false,
        error: 'example or quote is required',
      }),
    });
    const result = await submit({ input: {} });

    assert.deepEqual(result.gate, {
      ok: false,
      error: 'example or quote is required',
    });
    assert.equal(writes, 0);
  });

  it('upserts with skipTopicRegistry so soft topic_hint does not register topics', async () => {
    const writes = [];
    const submit = createSubmitKnowledgeObservation({
      formatObservationMarkdown: () => 'body',
      now: () => new Date('2026-08-09T10:00:00.000Z'),
      observationPagePath: ({ id }) => `raw/observations/2026-08-09/${id}`,
      runUpsertKnowledgePage: async (input) => {
        writes.push(input);

        return {
          ok: true,
          wikiPath: `en/topics/${input.topic}/${input.page}`,
        };
      },
      validateKnowledgeObservation: () => ({
        ok: true,
        observation: {
          ...observation,
          topic_hint: 'brand-new-soft-hint',
        },
      }),
    });

    await submit({ input: { ...observation, topic_hint: 'brand-new-soft-hint' } });

    assert.equal(writes.length, 1);
    assert.equal(writes[0].skipTopicRegistry, true);
    assert.equal(writes[0].topic, 'brand-new-soft-hint');
  });
});
