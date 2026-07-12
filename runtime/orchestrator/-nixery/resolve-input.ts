import type { TStorage } from '@/shared/transports/-types';

import type { TNixeryDef, TNixeryInputField } from '@project-yahl/shared/nixery/types';

const readContextValue = (storage: TStorage, key: string): unknown => {
  if (storage.context.has(key)) {
    return storage.context.get(key);
  }

  return undefined;
};

const resolveField = (storage: TStorage, value: string): string => {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  if (storage.context.has(trimmed)) {
    const resolved = readContextValue(storage, trimmed);

    if (typeof resolved === 'string') {
      return resolved.trim();
    }

    if (resolved != null && typeof resolved !== 'object') {
      return String(resolved);
    }

    if (resolved != null && typeof resolved === 'object') {
      return JSON.stringify(resolved, null, 2);
    }
  }

  return trimmed;
};

const resolveRawValue = (storage: TStorage, rawValue: unknown): string => {
  if (typeof rawValue === 'string') {
    return resolveField(storage, rawValue);
  }

  if (rawValue != null && typeof rawValue !== 'object') {
    return String(rawValue);
  }

  return '';
};

export const resolveNixeryInput = (
  storage: TStorage,
  raw: Record<string, unknown>,
  defInputSchema?: Record<string, TNixeryInputField>,
): Record<string, string> => {
  if (!defInputSchema) {
    return {};
  }

  const resolved: Record<string, string> = {};

  for (const [key, field] of Object.entries(defInputSchema)) {
    const value = resolveRawValue(storage, raw[key]);

    if (field.required && !value.trim()) {
      throw new Error(`nixery input requires non-empty ${key}`);
    }

    if (raw[key] !== undefined || value) {
      resolved[key] = value;
    }
  }

  return resolved;
};

export const resolveNixeryStageInput = (
  storage: TStorage,
  raw: Record<string, string | number | boolean>,
  defInputSchema?: Record<string, TNixeryInputField>,
) => resolveNixeryInput(storage, raw, defInputSchema);

const resolveLiteralValue = (rawValue: unknown): string => {
  if (typeof rawValue === 'string') {
    return rawValue.trim();
  }

  if (rawValue != null && typeof rawValue !== 'object') {
    return String(rawValue);
  }

  return '';
};

export const parseNixeryRunInputJson = (
  text: string,
  def: TNixeryDef,
): Record<string, string> => {
  const parsed = JSON.parse(text) as Record<string, unknown>;

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('nixery input must be a JSON object');
  }

  const schema = def.input ?? {};
  const resolved: Record<string, string> = {};

  for (const [key, field] of Object.entries(schema)) {
    const value = resolveLiteralValue(parsed[key]);

    if (field.required && !value.trim()) {
      throw new Error(`nixery input requires non-empty ${key}`);
    }

    if (parsed[key] !== undefined || value) {
      resolved[key] = value;
    }
  }

  return resolved;
};
