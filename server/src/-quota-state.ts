import fs from 'fs';
import path from 'path';

export type TQuotaState = {
  exhausted: boolean;
  remainingPercent: number;
};

const resolveQuotaStatePath = (): string | null => {
  const raw = process.env.QUOTA_STATE_FILE?.trim() ?? '';

  return raw.length > 0 ? raw : null;
};

const roundRemainingPercent = (value: number): number => {
  return Math.round(value * 10000) / 10000;
};

export const readQuotaState = (): TQuotaState | null => {
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

    if (typeof parsed.remainingPercent !== 'number' || !Number.isFinite(parsed.remainingPercent)) {
      return null;
    }

    return {
      exhausted: parsed.exhausted,
      remainingPercent: roundRemainingPercent(parsed.remainingPercent),
    };
  } catch {
    return null;
  }
};

export const writeQuotaState = (state: TQuotaState): void => {
  const filePath = resolveQuotaStatePath();

  if (!filePath) {
    throw errors.custom('QUOTA_STATE_FILE is not configured', 500);
  }

  const dir = path.dirname(filePath);

  fs.mkdirSync(dir, { recursive: true });

  const payload = JSON.stringify({
    exhausted: state.exhausted,
    remainingPercent: roundRemainingPercent(state.remainingPercent),
  });
  const tempPath = `${filePath}.tmp`;

  fs.writeFileSync(tempPath, payload, 'utf8');
  fs.renameSync(tempPath, filePath);
};
