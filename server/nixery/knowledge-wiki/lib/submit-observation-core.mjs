import { randomUUID } from 'node:crypto';

import { buildObservationInput } from './observation-input.mjs';

export const createSubmitKnowledgeObservation = (dependencies) =>
  async (params) => {
    const validated = dependencies.validateKnowledgeObservation(
      buildObservationInput(params.input),
    );

    if (!validated.ok) {
      return {
        gate: { ok: false, error: validated.error },
        observation: null,
        result: null,
      };
    }

    const observation = validated.observation;
    const id = params.incidentId?.trim() || randomUUID().slice(0, 12);
    const submittedAt = (dependencies.now?.() ?? new Date()).toISOString();
    const page = dependencies.observationPagePath({ id });
    const content = dependencies.formatObservationMarkdown(
      observation,
      { id, submittedAt },
    );
    const result = await dependencies.runUpsertKnowledgePage({
      topic: observation.topic_hint,
      page,
      content,
      mode: params.incidentId ? 'replace' : 'create',
      skipTopicRegistry: true,
      title: `Observation ${id}`,
    });
    const pathOut = result.ok
      ? (result.wikiPath ?? result.pagePath ?? result.path ?? '').replace(/^en\//, '')
      : '';
    const gate = result.ok && pathOut
      ? {
          ok: true,
          path: pathOut,
          observationId: id,
          topic: observation.topic_hint,
        }
      : {
          ok: false,
          error: result.error ?? 'observation upsert failed',
        };

    return { gate, observation, result };
  };
