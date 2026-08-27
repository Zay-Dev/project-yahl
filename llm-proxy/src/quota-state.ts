import fs from 'fs';

type TQuotaState = {
  exhausted: boolean;
  remainingPercent: number;
};

const resolveQuotaStatePath = (): string | null => {
  const raw = process.env.QUOTA_STATE_FILE?.trim() ?? '';

  return raw.length > 0 ? raw : null;
};

const readQuotaState = (): TQuotaState | null => {
  const filePath = resolveQuotaStatePath();

  if (!filePath) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8').trim();

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<TQuotaState>;

    if (typeof parsed.exhausted !== 'boolean') {
      return null;
    }

    return { exhausted: parsed.exhausted, remainingPercent: parsed.remainingPercent ?? 0 };
  } catch {
    return null;
  }
};

export const isQuotaExhausted = (): boolean => {
  const state = readQuotaState();

  return state?.exhausted ?? false;
};
