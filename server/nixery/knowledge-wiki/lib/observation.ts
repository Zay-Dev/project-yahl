import { OBSERVATION_INBOX_TOPIC } from './observation-topic.js';

export const OBSERVATION_CONFIDENCE = ['observed', 'quoted', 'inferred'] as const;

export type TObservationConfidence = (typeof OBSERVATION_CONFIDENCE)[number];

export type TKnowledgeObservation = {
  claim: string;
  confidence: TObservationConfidence;
  cue: string;
  example?: string;
  evidence: Record<string, unknown>;
  kind: 'observation';
  quote?: string;
  tags?: string[];
  topic_hint: string;
};

export const WIKI_OBSERVATIONS_PREFIX = 'raw/observations';

export const observationDayStamp = (at = new Date()): string =>
  at.toISOString().slice(0, 10);

export const observationPagePath = (params: {
  at?: Date;
  id: string;
}): string => {
  const day = observationDayStamp(params.at);
  const id = params.id.trim().replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80);

  return `${WIKI_OBSERVATIONS_PREFIX}/${day}/${id || 'obs'}`;
};

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
};

export const validateKnowledgeObservation = (
  value: unknown,
): { ok: true; observation: TKnowledgeObservation } | { ok: false; error: string } => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'observation must be an object' };
  }

  const raw = value as Record<string, unknown>;
  const kind = asNonEmptyString(raw.kind) ?? 'observation';

  if (kind !== 'observation') {
    return { ok: false, error: 'kind must be observation' };
  }

  const cue = asNonEmptyString(raw.cue);
  const claim = asNonEmptyString(raw.claim);
  const topicHint = asNonEmptyString(raw.topic_hint)
    ?? asNonEmptyString(raw.topicHint)
    ?? asNonEmptyString(raw.topic)
    ?? OBSERVATION_INBOX_TOPIC;
  const example = asNonEmptyString(raw.example) ?? undefined;
  const quote = asNonEmptyString(raw.quote) ?? undefined;
  const confidenceRaw = asNonEmptyString(raw.confidence) ?? 'observed';

  if (!cue) {
    return { ok: false, error: 'cue is required' };
  }

  if (!claim) {
    return { ok: false, error: 'claim is required' };
  }

  if (!OBSERVATION_CONFIDENCE.includes(confidenceRaw as TObservationConfidence)) {
    return { ok: false, error: 'confidence must be observed|quoted|inferred' };
  }

  if (!example && !quote) {
    return { ok: false, error: 'example or quote is required' };
  }

  const evidence = raw.evidence;

  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return { ok: false, error: 'evidence object is required' };
  }

  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim())
    : undefined;

  return {
    ok: true,
    observation: {
      claim,
      confidence: confidenceRaw as TObservationConfidence,
      cue,
      example,
      evidence: evidence as Record<string, unknown>,
      kind: 'observation',
      quote,
      tags,
      topic_hint: topicHint,
    },
  };
};

export const formatObservationMarkdown = (
  observation: TKnowledgeObservation,
  meta?: { id?: string; submittedAt?: string },
): string => {
  const lines = [
    `# Observation`,
    '',
    `- id: ${meta?.id ?? 'unknown'}`,
    `- submittedAt: ${meta?.submittedAt ?? new Date().toISOString()}`,
    `- topic_hint: ${observation.topic_hint}`,
    `- confidence: ${observation.confidence}`,
    `- cue: ${observation.cue}`,
  ];

  if (observation.tags?.length) {
    lines.push(`- tags: ${observation.tags.join(', ')}`);
  }

  lines.push('', '## Claim', '', observation.claim, '');

  if (observation.example) {
    lines.push('## Example', '', observation.example, '');
  }

  if (observation.quote) {
    lines.push('## Quote', '', observation.quote, '');
  }

  lines.push('## Evidence', '', '```json', JSON.stringify(observation.evidence, null, 2), '```', '');

  return `${lines.join('\n').trim()}\n`;
};
