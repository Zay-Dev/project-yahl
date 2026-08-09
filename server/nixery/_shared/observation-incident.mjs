import { createHash } from 'node:crypto';

const stableValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }

  return value;
};

export const resolveObservationIncidentId = (input, observation) => {
  const payload = stableValue({
    evidence: observation.evidence,
    requestId: input.requestId ?? null,
    sessionId: input.sessionId ?? null,
    tool: input.tool ?? observation.evidence?.tool ?? null,
  });
  const digest = createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 12);

  return `error-${digest}`;
};
