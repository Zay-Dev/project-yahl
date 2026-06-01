import type { TChatToolCall, TStorage } from '@/shared/transports/-types';
import type { SetContextToolCallEnvelope } from '@/shared/stage-contract';

export const createStorage = () => {
  return {
    context: new Map<string, unknown>(),
    types: new Map<string, unknown>(),
  };
}

export const setContext = async (storage: TStorage, toolCall: TChatToolCall) => {
  const { type } = toolCall;
  const func = toolCall.function;

  if (type !== 'function' && func.name !== 'set_context') {
    return;
  }

  const { scope, key, value, operation } =
    JSON.parse(func.arguments) as SetContextToolCallEnvelope['arguments'];

  const bucket = scope === 'types' ? storage.types : storage.context;
  const current = bucket.get(key) || {};
  
  const nextValue = operation === "extend"
    ? [current[key], value]
    : value;

  bucket.set(key, nextValue);
};