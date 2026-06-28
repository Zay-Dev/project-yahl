import type { TStorage } from '@/shared/transports/-types';

export const PLATFORM_CONTEXT_KEYS = ['today', 'now_iso'] as const;

export type TPlatformContextKey = typeof PLATFORM_CONTEXT_KEYS[number];

export const defaultContextValues = (): Record<TPlatformContextKey, string> => {
  const now = new Date();

  return {
    now_iso: now.toISOString(),
    today: now.toISOString().slice(0, 10),
  };
};

export const seedDefaultContext = (storage: TStorage) => {
  for (const [key, value] of Object.entries(defaultContextValues())) {
    storage.context.set(key, value);
  }
};

export const seedRunInputContext = (
  storage: TStorage,
  runInput: Record<string, unknown> | undefined,
  runInputContextKeys: string[] | undefined,
) => {
  if (
    !runInputContextKeys?.length ||
    !runInput ||
    typeof runInput !== 'object' ||
    Array.isArray(runInput)
  ) {
    return;
  }

  for (const key of runInputContextKeys) {
    const value = runInput[key];

    if (value === undefined || value === null) {
      continue;
    }

    storage.context.set(key, typeof value === 'string' ? value.trim() : value);
  }
};
