import type { TChatToolCall, TStorage } from '@/shared/transports/-types';
import type { SetContextToolCallEnvelope } from '@/shared/stage-contract';

import { seedDefaultContext } from '@/orchestrator/-context/default-context';

export const createStorage = () => {
  const storage = {
    context: new Map<string, unknown>(),
    types: new Map<string, unknown>(),
  };

  seedDefaultContext(storage);

  return storage;
};

const resolveExtendValue = (current: unknown, value: unknown) => {
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

export const setContext = async (storage: TStorage, toolCall: TChatToolCall) => {
  const { type } = toolCall;
  const func = toolCall.function;

  if (type !== 'function' && func.name !== 'set_context') {
    return;
  }

  const { scope, key, value, operation } =
    JSON.parse(func.arguments) as SetContextToolCallEnvelope['arguments'];

  const bucket = scope === 'types' ? storage.types : storage.context;
  const current = bucket.get(key);
  const normalizedValue = unwrapDoubleEncodedString(value);

  const nextValue = operation === 'extend'
    ? resolveExtendValue(current, normalizedValue)
    : normalizedValue;

  bucket.set(key, nextValue);

  if (key === 'verify_rebuttal' && scope !== 'types' && normalizedValue != null) {
    const prior = Number(storage.context.get('verify_rebuttal_count') ?? 0);

    storage.context.set(
      'verify_rebuttal_count',
      Number.isFinite(prior) ? prior + 1 : 1,
    );
  }
};
