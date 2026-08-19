import type { TYahlWhileSetupSpec } from './types';

export const DEFAULT_WHILE_DO_AT_LEAST = 1;

export type TParsedYahlWhileSetup = {
  condition: string;
  doAtLeast: number;
};

export const parseYahlWhileSetup = (
  raw: unknown,
  label: string,
): TParsedYahlWhileSetup | undefined => {
  if (raw === undefined) {
    return undefined;
  }

  if (typeof raw === 'string') {
    const condition = raw.trim();

    if (!condition) {
      throw new Error(`${label}.whileSetup: required non-empty string`);
    }

    return { condition, doAtLeast: DEFAULT_WHILE_DO_AT_LEAST };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${label}.whileSetup: must be a string or { condition, doAtLeast? }`);
  }

  const entry = raw as Record<string, unknown>;
  const condition = typeof entry.condition === 'string' ? entry.condition.trim() : '';

  if (!condition) {
    throw new Error(`${label}.whileSetup.condition: required non-empty string`);
  }

  if (entry.doAtLeast === undefined) {
    return { condition, doAtLeast: DEFAULT_WHILE_DO_AT_LEAST };
  }

  const doAtLeast = Number(entry.doAtLeast);

  if (!Number.isInteger(doAtLeast) || doAtLeast < 1) {
    throw new Error(`${label}.whileSetup.doAtLeast: must be an integer >= 1`);
  }

  return { condition, doAtLeast };
};

export const persistYahlWhileSetup = (
  raw: unknown,
  label: string,
): string | TYahlWhileSetupSpec | undefined => {
  if (raw === undefined) {
    return undefined;
  }

  if (typeof raw === 'string') {
    const parsed = parseYahlWhileSetup(raw, label);

    return parsed?.condition;
  }

  const parsed = parseYahlWhileSetup(raw, label);

  if (!parsed) {
    return undefined;
  }

  return parsed.doAtLeast === DEFAULT_WHILE_DO_AT_LEAST
    ? { condition: parsed.condition }
    : { condition: parsed.condition, doAtLeast: parsed.doAtLeast };
};
