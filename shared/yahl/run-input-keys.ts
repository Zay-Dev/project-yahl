import YAML from 'yaml';

export const parseRunInputContextKeys = (raw: unknown): string[] | undefined => {
  if (raw === undefined) {
    return undefined;
  }

  if (!Array.isArray(raw)) {
    throw new Error('runInput: must be an array when present');
  }

  const keys: string[] = [];
  const seen = new Set<string>();

  for (const [index, entry] of raw.entries()) {
    if (typeof entry !== 'string' || !entry.trim()) {
      throw new Error(`runInput[${index}]: must be a non-empty string`);
    }

    const key = entry.trim();

    if (seen.has(key)) {
      throw new Error(`runInput: duplicate key "${key}"`);
    }

    seen.add(key);
    keys.push(key);
  }

  return keys.length > 0 ? keys : undefined;
};

export const parseRunInputKeysFromYahl = (yahl: string): string[] | undefined => {
  const parsed = YAML.parse(yahl);

  if (!parsed || typeof parsed !== 'object') {
    return undefined;
  }

  return parseRunInputContextKeys((parsed as Record<string, unknown>).runInput);
};

export type TRunInputValidation =
  | { ok: true }
  | { ok: false; message: string };

export const validateRunInputPayload = (
  runInput: Record<string, unknown> | undefined,
  runInputKeys: string[] | undefined,
): TRunInputValidation => {
  const input = runInput ?? {};
  const inputKeys = Object.keys(input);

  if (!runInputKeys?.length) {
    if (inputKeys.length > 0) {
      return { ok: false, message: 'Task does not accept runInput' };
    }

    return { ok: true };
  }

  const allow = new Set(runInputKeys);
  const unknown = inputKeys.filter((key) => !allow.has(key));

  if (unknown.length > 0) {
    return { ok: false, message: `Unknown runInput keys: ${unknown.join(', ')}` };
  }

  return { ok: true };
};
