const _bucketFromPayload = (
  payload: Record<string, unknown> | undefined,
  bucket: 'context' | 'stage' | 'types',
) => {
  if (!payload) {
    return {};
  }

  const nested = payload[bucket];

  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }

  if (bucket === 'context' && payload.context && typeof payload.context === 'object' && !Array.isArray(payload.context)) {
    const contextBucket = payload.context as Record<string, unknown>;

    if (!('context' in contextBucket)) {
      return contextBucket;
    }
  }

  if (bucket === 'types' && payload.types && typeof payload.types === 'object' && !Array.isArray(payload.types)) {
    return payload.types as Record<string, unknown>;
  }

  return {};
};

export const mergeContextPayloadIntoRecord = (
  target: Record<string, unknown>,
  payload: Record<string, unknown> | undefined,
) => {
  if (!payload || typeof payload !== 'object') {
    return target;
  }

  const contextBucket = _bucketFromPayload(payload, 'context');
  const stageBucket = _bucketFromPayload(payload, 'stage');
  const typesBucket = _bucketFromPayload(payload, 'types');

  const context = (target.context && typeof target.context === 'object' && !Array.isArray(target.context)
    ? target.context
    : {}) as Record<string, unknown>;
  const types = (target.types && typeof target.types === 'object' && !Array.isArray(target.types)
    ? target.types
    : {}) as Record<string, unknown>;

  return {
    ...target,
    context: {
      ...context,
      ...contextBucket,
      ...stageBucket,
    },
    types: {
      ...types,
      ...typesBucket,
    },
  };
};
