const parseMaybeJson = (value) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const parseTags = (value) => {
  const parsed = parseMaybeJson(value);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (typeof parsed === 'string' && parsed.trim()) {
    return parsed.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return undefined;
};

const normalizeEvidence = (value, sessionId) => {
  const parsed = parseMaybeJson(value);

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed;
  }

  if (typeof parsed === 'string' && parsed.trim()) {
    return { note: parsed.trim(), sessionId: sessionId ?? null };
  }

  return { sessionId: sessionId ?? null };
};

export const buildObservationInput = (input) => {
  const nested = parseMaybeJson(input.observation);

  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested;
  }

  const proseObservation = typeof nested === 'string' && nested.trim()
    ? nested.trim()
    : undefined;

  const example = input.example
    ?? (proseObservation && !input.quote ? proseObservation : undefined);

  return {
    kind: 'observation',
    topic_hint: input.topic_hint ?? input.topicHint ?? input.topic,
    cue: input.cue,
    claim: input.claim,
    example,
    quote: input.quote,
    evidence: normalizeEvidence(input.evidence, input.sessionId),
    confidence: input.confidence,
    tags: parseTags(input.tags),
  };
};
