import type { TStorage } from '@/shared/transports/-types';

const _isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const _bucketFromPayload = (
  payload: Record<string, unknown> | undefined,
  bucket: 'context' | 'stage' | 'types',
) => {
  if (!payload) {
    return {};
  }

  const nested = payload[bucket];

  if (_isRecord(nested)) {
    return nested;
  }

  if (bucket === 'context' && _isRecord(payload.context) && !_isRecord(payload.context.context)) {
    return payload.context;
  }

  if (bucket === 'types' && _isRecord(payload.types)) {
    return payload.types;
  }

  return {};
};

export const storageFromContextPayload = (
  payload: Record<string, unknown> | undefined,
): TStorage => {
  const contextBucket = _bucketFromPayload(payload, 'context');
  const stageBucket = _bucketFromPayload(payload, 'stage');
  const typesBucket = _bucketFromPayload(payload, 'types');

  const context = new Map<string, unknown>(Object.entries({
    ...contextBucket,
    ...stageBucket,
  }));
  const types = new Map<string, unknown>(Object.entries(typesBucket));

  return { context, types };
};

const _stageBucketKeys = new Set(['context', 'stage', 'types']);

const _isStageContextPayload = (record: Record<string, unknown>) => {
  if (_isRecord(record.stage)) {
    return true;
  }

  const contextBucket = record.context;

  if (!_isRecord(contextBucket)) {
    return false;
  }

  const keys = Object.keys(contextBucket);

  return keys.length > 0 && keys.every((key) => _stageBucketKeys.has(key));
};

export const storageFromSnapshot = (
  snapshot: unknown,
): TStorage | undefined => {
  if (!snapshot || typeof snapshot !== 'object') {
    return undefined;
  }

  const record = snapshot as Record<string, unknown>;

  if (_isStageContextPayload(record)) {
    return storageFromContextPayload(record);
  }

  const context = record.context;
  const stageBucket = record.stage;
  const types = record.types;

  return {
    context: new Map(Object.entries({
      ...(context && typeof context === 'object' && !Array.isArray(context)
        ? context as Record<string, unknown>
        : {}),
      ...(stageBucket && typeof stageBucket === 'object' && !Array.isArray(stageBucket)
        ? stageBucket as Record<string, unknown>
        : {}),
    })),
    types: new Map(Object.entries(
      types && typeof types === 'object' && !Array.isArray(types)
        ? types as Record<string, unknown>
        : {},
    )),
  };
};

export const storageFromSerializedRecord = (
  record: Record<string, unknown> | undefined,
): TStorage | undefined => storageFromSnapshot(record);

export const mergeContextPayloadToStorage = (
  storage: TStorage,
  payload: Record<string, unknown> | undefined,
) => {
  const next = storageFromContextPayload(payload);

  for (const [key, value] of next.context) {
    storage.context.set(key, value);
  }

  for (const [key, value] of next.types) {
    storage.types.set(key, value);
  }
};