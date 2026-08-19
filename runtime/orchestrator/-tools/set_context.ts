import type { TChatToolCall, TStorage } from '@/shared/transports/-types';
import type { SetContextToolCallEnvelope } from '@/shared/stage-contract';

import { seedDefaultContext } from '@/orchestrator/-context/default-context';

export const SET_CONTEXT_EXTEND_RETIRED =
  'set_context: operation extend is retired; use extend_context to append onto arrays';

export const createStorage = () => {
  const storage = {
    context: new Map<string, unknown>(),
    types: new Map<string, unknown>(),
  };

  seedDefaultContext(storage);

  return storage;
};

export const resolveExtendValue = (current: unknown, value: unknown) => {
  if (Array.isArray(current)) {
    return Array.isArray(value) ? [...current, ...value] : [...current, value];
  }

  if (current === undefined) {
    return Array.isArray(value) ? [...value] : [value];
  }

  return [current, value];
};

export const unwrapDoubleEncodedString = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  if (trimmed.length < 2 || !trimmed.startsWith('"') || !trimmed.endsWith('"')) {
    return value;
  }

  try {
    const parsed = JSON.parse(trimmed);

    return typeof parsed === 'string' ? parsed : value;
  } catch {
    return value;
  }
};

const _bucketForScope = (storage: TStorage, scope: 'global' | 'types') =>
  scope === 'types' ? storage.types : storage.context;

export const extendContext = async (
  storage: TStorage,
  args: { key: string; scope: 'global' | 'types'; value: unknown },
) => {
  const bucket = _bucketForScope(storage, args.scope);
  const current = bucket.get(args.key);
  const normalizedValue = unwrapDoubleEncodedString(args.value);

  bucket.set(args.key, resolveExtendValue(current, normalizedValue));
};

export const setContext = async (storage: TStorage, toolCall: TChatToolCall) => {
  const { type } = toolCall;
  const func = toolCall.function;

  if (type !== 'function' && func.name !== 'set_context') {
    return;
  }

  const parsed = JSON.parse(func.arguments) as Record<string, unknown>;

  if (parsed.operation === 'extend') {
    throw new Error(SET_CONTEXT_EXTEND_RETIRED);
  }

  const { scope, key, value } = parsed as SetContextToolCallEnvelope['arguments'];

  const bucket = _bucketForScope(storage, scope === 'types' ? 'types' : 'global');
  const normalizedValue = unwrapDoubleEncodedString(value);

  bucket.set(key, normalizedValue);

  if (key === 'verify_rebuttal' && scope !== 'types' && normalizedValue != null) {
    const prior = Number(storage.context.get('verify_rebuttal_count') ?? 0);

    storage.context.set(
      'verify_rebuttal_count',
      Number.isFinite(prior) ? prior + 1 : 1,
    );
  }
};
