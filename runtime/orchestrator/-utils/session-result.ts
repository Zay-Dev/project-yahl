import type { TStorage } from '@/shared/transports/-types';

export const publishSessionResult = async (
  sessionId: string,
  resultContextKey: string | undefined,
  storage: TStorage,
) => {
  if (!resultContextKey?.trim()) {
    return;
  }

  const result = storage.context.has(resultContextKey)
    ? storage.context.get(resultContextKey) ?? null
    : null;

  await globalThis.sessionTracker?.patchSession(sessionId, { result });
  await globalThis.sessionTracker?.flush?.();
};
