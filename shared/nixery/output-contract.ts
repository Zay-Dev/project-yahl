import type { TNixeryDef, TNixeryOutputSpec } from './types';

export const DEFAULT_NIXERY_OUTPUT_FILE = 'output.md';

export const DEFAULT_VALIDATION_MODULE = 'validation.mjs';

export const DEFAULT_NIXERY_OUTPUT_RETRY = 10;

export const resolveNixeryOutputRetry = (def: TNixeryDef): number => {
  const retry = def.output?.retry;

  if (typeof retry === 'number' && Number.isInteger(retry) && retry >= 0) {
    return retry;
  }

  return DEFAULT_NIXERY_OUTPUT_RETRY;
};

export const resolveNixeryOutputSpec = (def: TNixeryDef): Required<TNixeryOutputSpec> => ({
  default: def.output?.default?.trim() || DEFAULT_NIXERY_OUTPUT_FILE,
  retry: resolveNixeryOutputRetry(def),
  validate: def.output?.validate?.trim() || DEFAULT_VALIDATION_MODULE,
});

export const resolveNixeryOutputHint = (
  def: TNixeryDef,
  args: Record<string, unknown>,
) => {
  if (typeof args.output === 'string' && args.output.trim()) {
    return args.output.trim();
  }

  return resolveNixeryOutputSpec(def).default;
};

export const resolveNixeryInlineToolResult = (
  parsed: Record<string, unknown>,
): { data: Record<string, unknown>; error?: string; ok: boolean } => {
  if (parsed.ok === true) {
    return { data: parsed, ok: true };
  }

  if (parsed.ok === false) {
    return {
      data: parsed,
      error: typeof parsed.error === 'string' ? parsed.error : 'nixery failed',
      ok: false,
    };
  }

  return { data: parsed, ok: true };
};
