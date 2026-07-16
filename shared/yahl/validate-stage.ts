import type { TYahlAskUserEntry, TYahlStage, TYahlVerifySpec } from './types';
import { DEFAULT_VERIFY_DEF_ID } from './verify';

const LOOP_SETUP_PATTERN = /^\s*for each\s+\w+\s+of\s+\[.*\]\s*$/i;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isAskUserId = (value: unknown): value is number | string =>
  typeof value === 'number' && Number.isFinite(value)
  || typeof value === 'string' && value.trim().length > 0;

const isAskUserAnswer = (value: unknown): value is number | string | string[] => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return true;
  }

  if (typeof value === 'string') {
    return true;
  }

  return isStringArray(value) && value.length > 0;
};

const validateAskUserEntry = (
  raw: unknown,
  label: string,
): TYahlAskUserEntry => {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`${label}: expected an object`);
  }

  const entry = raw as Record<string, unknown>;

  if (!isAskUserId(entry.id)) {
    throw new Error(`${label}.id: required number or non-empty string`);
  }

  if (typeof entry.question !== 'string' || !entry.question.trim()) {
    throw new Error(`${label}.question: required non-empty string`);
  }

  if (entry.answer !== undefined && !isAskUserAnswer(entry.answer)) {
    throw new Error(`${label}.answer: must be a number, string, or non-empty string array when present`);
  }

  if (entry.options !== undefined) {
    if (!Array.isArray(entry.options) || entry.options.length < 2) {
      throw new Error(`${label}.options: must be an array with at least 2 items when present`);
    }

    entry.options.forEach((option, index) => {
      if (!option || typeof option !== 'object') {
        throw new Error(`${label}.options[${index}]: expected an object`);
      }

      const item = option as Record<string, unknown>;

      if (typeof item.id !== 'string' || !item.id.trim()) {
        throw new Error(`${label}.options[${index}].id: required non-empty string`);
      }

      if (typeof item.label !== 'string' || !item.label.trim()) {
        throw new Error(`${label}.options[${index}].label: required non-empty string`);
      }
    });
  }

  return {
    id: String(entry.id).trim(),
    question: entry.question.trim(),
    ...(entry.answer !== undefined
      ? { answer: entry.answer as number | string | string[] }
      : {}),
    ...(Array.isArray(entry.options)
      ? {
        options: entry.options.map((option) => {
          const item = option as Record<string, unknown>;

          return {
            id: String(item.id).trim(),
            label: String(item.label).trim(),
            ...(typeof item.description === 'string' && item.description.trim()
              ? { description: item.description.trim() }
              : {}),
          };
        }),
      }
      : {}),
  };
};

const isNixeryStageInput = (value: unknown): value is Record<string, string | number | boolean> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return Object.keys(value).length > 0;
};

const normalizeNixeryStageInput = (
  raw: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> => {
  const normalized: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') {
      normalized[key] = value.trim();
      continue;
    }

    normalized[key] = value;
  }

  return normalized;
};

const hasVerifyEnabled = (verify: unknown): boolean => {
  if (verify === true) {
    return true;
  }

  return Boolean(verify && typeof verify === 'object' && !Array.isArray(verify));
};

const normalizeVerifySpec = (
  raw: unknown,
  label: string,
): TYahlVerifySpec | undefined => {
  if (raw === undefined || raw === false) {
    return undefined;
  }

  if (raw === true) {
    return { defId: DEFAULT_VERIFY_DEF_ID };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${label}.verify: must be true or an object`);
  }

  const entry = raw as Record<string, unknown>;
  const defId = typeof entry.defId === 'string' && entry.defId.trim()
    ? entry.defId.trim()
    : DEFAULT_VERIFY_DEF_ID;

  if (entry.minScore !== undefined) {
    const score = Number(entry.minScore);

    if (!Number.isFinite(score) || score < 0 || score > 1) {
      throw new Error(`${label}.verify.minScore: must be a number from 0 to 1`);
    }
  }

  if (entry.rubric !== undefined && typeof entry.rubric !== 'string') {
    throw new Error(`${label}.verify.rubric: must be a string when present`);
  }

  if (entry.autoRetry !== undefined && typeof entry.autoRetry !== 'boolean') {
    throw new Error(`${label}.verify.autoRetry: must be a boolean when present`);
  }

  if (entry.resume !== undefined && typeof entry.resume !== 'boolean') {
    throw new Error(`${label}.verify.resume: must be a boolean when present`);
  }

  return {
    defId,
    ...(entry.autoRetry === true ? { autoRetry: true } : {}),
    ...(entry.minScore !== undefined ? { minScore: Number(entry.minScore) } : {}),
    ...(entry.resume === false ? { resume: false } : {}),
    ...(typeof entry.rubric === 'string' && entry.rubric.trim()
      ? { rubric: entry.rubric.trim() }
      : {}),
  };
};

const assertStageFields = (stage: Record<string, unknown>, label: string): TYahlStage => {
  const nixeryRun = typeof stage.nixeryRun === 'string' && stage.nixeryRun.trim()
    ? stage.nixeryRun.trim()
    : undefined;

  const logicRaw = typeof stage.logic === 'string' ? stage.logic.trim() : '';

  if (!nixeryRun && !logicRaw) {
    throw new Error(`${label}.logic: required non-empty string`);
  }

  if (nixeryRun) {
    if (stage.contextMode === true || stage.conditionMode === true) {
      throw new Error(`${label}: nixeryRun cannot combine with contextMode or conditionMode`);
    }

    if (hasVerifyEnabled(stage.verify)) {
      throw new Error(`${label}: nixeryRun cannot combine with verify`);
    }

    if (stage.loopSetup !== undefined) {
      throw new Error(`${label}: nixeryRun cannot combine with loopSetup`);
    }

    if (stage.produceContextKeys !== undefined) {
      throw new Error(`${label}: nixeryRun stages must not set produceContextKeys`);
    }

    if (!isNixeryStageInput(stage.nixeryInput)) {
      throw new Error(`${label}.nixeryInput: required non-empty object when nixeryRun is set`);
    }
  }

  if (stage.contextMode === true && stage.conditionMode === true) {
    throw new Error(`${label}: contextMode and conditionMode are mutually exclusive`);
  }

  if (stage.conditionMode === true && stage.loopSetup !== undefined) {
    throw new Error(`${label}: conditionMode and loopSetup are mutually exclusive`);
  }

  if (stage.loopSetup !== undefined) {
    if (typeof stage.loopSetup !== 'string' || !LOOP_SETUP_PATTERN.test(stage.loopSetup.trim())) {
      throw new Error(`${label}.loopSetup: must match "for each <id> of [...]"`);
    }
  }

  if (stage.temperature !== undefined) {
    const temperature = Number(stage.temperature);

    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
      throw new Error(`${label}.temperature: must be a number from 0 to 2`);
    }
  }

  for (const key of [
    'contextKeys',
    'updateContextKeys',
    'produceContextKeys',
    'produceTypeKeys',
  ] as const) {
    if (stage[key] !== undefined && !isStringArray(stage[key])) {
      throw new Error(`${label}.${key}: must be a string array`);
    }
  }

  if (stage.version !== undefined) {
    const version = Number(stage.version);

    if (!Number.isInteger(version) || version < 1) {
      throw new Error(`${label}.version: must be a positive integer`);
    }
  }

  if (stage.conditionMode === true && !nixeryRun && !logicRaw.includes('IF:')) {
    throw new Error(`${label}: conditionMode logic must contain IF:`);
  }

  let askUser: TYahlAskUserEntry[] | undefined;

  if (stage.askUser !== undefined) {
    if (!Array.isArray(stage.askUser) || stage.askUser.length === 0) {
      throw new Error(`${label}.askUser: must be a non-empty array when present`);
    }

    const seenIds = new Set<string>();

    askUser = stage.askUser.map((entry, index) => {
      const validated = validateAskUserEntry(entry, `${label}.askUser[${index}]`);

      if (seenIds.has(validated.id)) {
        throw new Error(`${label}.askUser: duplicate id "${validated.id}"`);
      }

      seenIds.add(validated.id);

      return validated;
    });
  }

  const verify = normalizeVerifySpec(stage.verify, label);

  return {
    logic: logicRaw || '(nixery)',
    ...(nixeryRun ? { nixeryRun } : {}),
    ...(isNixeryStageInput(stage.nixeryInput)
      ? { nixeryInput: normalizeNixeryStageInput(stage.nixeryInput) }
      : {}),
    ...(askUser ? { askUser } : {}),
    ...(stage.contextMode === true ? { contextMode: true } : {}),
    ...(stage.conditionMode === true ? { conditionMode: true } : {}),
    ...(typeof stage.loopSetup === 'string' ? { loopSetup: stage.loopSetup.trim() } : {}),
    ...(stage.temperature !== undefined ? { temperature: Number(stage.temperature) } : {}),
    ...(isStringArray(stage.contextKeys) ? { contextKeys: stage.contextKeys } : {}),
    ...(isStringArray(stage.updateContextKeys) ? { updateContextKeys: stage.updateContextKeys } : {}),
    ...(isStringArray(stage.produceContextKeys) ? { produceContextKeys: stage.produceContextKeys } : {}),
    ...(isStringArray(stage.produceTypeKeys) ? { produceTypeKeys: stage.produceTypeKeys } : {}),
    ...(verify ? { verify } : {}),
    ...(stage.version !== undefined ? { version: Number(stage.version) } : {}),
  };
};

export const validateYahlStage = (raw: unknown, index?: number): TYahlStage => {
  if (!raw || typeof raw !== 'object') {
    throw new Error(index === undefined ? 'stage: expected an object' : `stages[${index}]: expected an object`);
  }

  return assertStageFields(
    raw as Record<string, unknown>,
    index === undefined ? 'stage' : `stages[${index}]`,
  );
};
