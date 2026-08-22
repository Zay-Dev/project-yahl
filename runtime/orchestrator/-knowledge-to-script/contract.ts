import {
  assertScriptId,
  SCRIPT_ID_PATTERN,
} from '@project-yahl/shared/yahl/knowledge-to-script';

export type TScriptKind = 'js' | 'recipe';

export type TScriptMeta = {
  kind?: TScriptKind;
  lastFirstTryOkAt?: string;
  outputSchema?: string;
  requiredFields?: string[];
  scriptId: string;
  sourceKeys?: string[];
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

export const parseScriptMeta = (raw: unknown): TScriptMeta | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const entry = raw as Record<string, unknown>;
  const scriptId = typeof entry.scriptId === 'string' ? entry.scriptId.trim() : '';

  if (!scriptId || !SCRIPT_ID_PATTERN.test(scriptId)) {
    return null;
  }

  const kind = entry.kind;

  if (kind !== undefined && kind !== 'js' && kind !== 'recipe') {
    return null;
  }

  if (entry.sourceKeys !== undefined && !isStringArray(entry.sourceKeys)) {
    return null;
  }

  if (entry.requiredFields !== undefined && !isStringArray(entry.requiredFields)) {
    return null;
  }

  return {
    scriptId,
    ...(kind ? { kind } : {}),
    ...(isStringArray(entry.sourceKeys) ? { sourceKeys: entry.sourceKeys } : {}),
    ...(typeof entry.outputSchema === 'string' && entry.outputSchema.trim()
      ? { outputSchema: entry.outputSchema.trim() }
      : {}),
    ...(typeof entry.lastFirstTryOkAt === 'string' && entry.lastFirstTryOkAt.trim()
      ? { lastFirstTryOkAt: entry.lastFirstTryOkAt.trim() }
      : {}),
    ...(isStringArray(entry.requiredFields) ? { requiredFields: entry.requiredFields } : {}),
  };
};

export type TScriptOutputContract = Pick<TScriptMeta, 'outputSchema' | 'requiredFields'>;

export const validateScriptOutput = (
  result: unknown,
  contract: TScriptOutputContract = {},
): boolean => {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return false;
  }

  const record = result as Record<string, unknown>;

  if (contract.requiredFields?.length) {
    if (!contract.requiredFields.every((field) => field in record)) {
      return false;
    }
  }

  return true;
};

export const scriptGoalMet = (
  result: unknown,
  contract: TScriptOutputContract,
): boolean => validateScriptOutput(result, contract);

export const loadScriptMeta = async (metaPath: string): Promise<TScriptMeta | null> => {
  const { readFile } = await import('node:fs/promises');

  try {
    const raw = JSON.parse(await readFile(metaPath, 'utf8')) as unknown;

    return parseScriptMeta(raw);
  } catch {
    return null;
  }
};

export const assertScriptMetaScriptId = (scriptId: string, meta: TScriptMeta) => {
  assertScriptId(scriptId);

  if (meta.scriptId !== scriptId.trim()) {
    throw new Error(`script meta scriptId mismatch: expected ${scriptId}, got ${meta.scriptId}`);
  }
};
