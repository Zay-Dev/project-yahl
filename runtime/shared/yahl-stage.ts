import {
  parseStageGotoCommand,
  STAGE_ID_PATTERN,
} from '@project-yahl/shared/yahl/stage-goto';
import {
  DEFAULT_VERIFY_DEF_ID,
  type TYahlVerifySpec,
} from '@project-yahl/shared/yahl/verify';

export type { TYahlVerifySpec } from '@project-yahl/shared/yahl/verify';
export { DEFAULT_VERIFY_DEF_ID } from '@project-yahl/shared/yahl/verify';

export type YahlAskUserOption = {
  description?: string;
  id: string;
  label: string;
};

export type YahlAskUserEntry = {
  answer?: number | string | string[];
  id: string;
  options?: YahlAskUserOption[];
  question: string;
};

export type TNixeryStageInput = Record<string, string | number | boolean>;

export type YahlAgentOverrides = {
  bashTimeoutMs?: number;
};

export type YahlStagehandConfig = {
  apiBaseUrl?: string;
  model?: string;
  preferScreenshot?: boolean;
};

export type YahlGotoEntry = {
  command: string;
  description: string;
};

export interface YahlStage {
  agentOverrides?: YahlAgentOverrides;
  askUser?: YahlAskUserEntry[];
  conditionMode?: boolean;
  contextKeys?: string[];
  contextMode?: boolean;
  goto?: YahlGotoEntry[];
  id?: string;
  logic: string;
  loopSetup?: string;
  maxBashCalls?: number;
  maxTurns?: number;
  nixeryInput?: TNixeryStageInput;
  nixeryRun?: string;
  produceContextKeys?: string[];
  produceTypeKeys?: string[];
  stagehand?: YahlStagehandConfig;
  temperature?: number;
  updateContextKeys?: string[];
  verify?: TYahlVerifySpec;
  version?: number;
}

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
): YahlAskUserEntry => {
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

const validateAgentOverrides = (
  raw: unknown,
  label: string,
): YahlAgentOverrides | undefined => {
  if (raw === undefined) {
    return undefined;
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${label}.agentOverrides: expected an object`);
  }

  const entry = raw as Record<string, unknown>;

  for (const key of Object.keys(entry)) {
    if (key !== 'bashTimeoutMs') {
      throw new Error(
        `${label}.agentOverrides: unknown key "${key}" (only bashTimeoutMs allowed)`,
      );
    }
  }

  if (entry.bashTimeoutMs === undefined) {
    return {};
  }

  const bashTimeoutMs = Number(entry.bashTimeoutMs);

  if (!Number.isInteger(bashTimeoutMs) || bashTimeoutMs < 1) {
    throw new Error(`${label}.agentOverrides.bashTimeoutMs: must be a positive integer`);
  }

  return { bashTimeoutMs };
};

const STAGEHAND_KEYS = new Set(['apiBaseUrl', 'model', 'preferScreenshot']);

const validateStagehandConfig = (
  raw: unknown,
  label: string,
): YahlStagehandConfig | undefined => {
  if (raw === undefined) {
    return undefined;
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${label}.stagehand: expected an object`);
  }

  const entry = raw as Record<string, unknown>;

  for (const key of Object.keys(entry)) {
    if (!STAGEHAND_KEYS.has(key)) {
      throw new Error(
        `${label}.stagehand: unknown key "${key}" (only apiBaseUrl, model, preferScreenshot allowed)`,
      );
    }
  }

  const config: YahlStagehandConfig = {};

  if (entry.model !== undefined) {
    if (typeof entry.model !== 'string' || !entry.model.trim()) {
      throw new Error(`${label}.stagehand.model: must be a non-empty string`);
    }

    config.model = entry.model.trim();
  }

  if (entry.apiBaseUrl !== undefined) {
    if (typeof entry.apiBaseUrl !== 'string' || !entry.apiBaseUrl.trim()) {
      throw new Error(`${label}.stagehand.apiBaseUrl: must be a non-empty string`);
    }

    config.apiBaseUrl = entry.apiBaseUrl.trim();
  }

  if (entry.preferScreenshot !== undefined) {
    if (typeof entry.preferScreenshot !== 'boolean') {
      throw new Error(`${label}.stagehand.preferScreenshot: must be a boolean`);
    }

    config.preferScreenshot = entry.preferScreenshot;
  }

  return config;
};

const validateGotoEntries = (
  raw: unknown,
  label: string,
  stage: Record<string, unknown>,
): YahlGotoEntry[] | undefined => {
  if (raw === undefined) {
    return undefined;
  }

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`${label}.goto: must be a non-empty array when present`);
  }

  if (stage.contextMode === true || stage.conditionMode === true) {
    throw new Error(`${label}.goto: cannot combine with contextMode or conditionMode`);
  }

  if (typeof stage.nixeryRun === 'string' && stage.nixeryRun.trim()) {
    throw new Error(`${label}.goto: cannot combine with nixeryRun`);
  }

  return raw.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`${label}.goto[${index}]: expected an object`);
    }

    const item = entry as Record<string, unknown>;
    const command = typeof item.command === 'string' ? item.command.trim() : '';
    const description = typeof item.description === 'string' ? item.description.trim() : '';

    if (!command || !parseStageGotoCommand(command)) {
      throw new Error(
        `${label}.goto[${index}].command: must match /stage(<id>)`,
      );
    }

    if (!description) {
      throw new Error(`${label}.goto[${index}].description: required non-empty string`);
    }

    return { command, description };
  });
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

const assertStageFields = (stage: Record<string, unknown>, label: string): YahlStage => {
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

  if (stage.maxBashCalls !== undefined) {
    const maxBashCalls = Number(stage.maxBashCalls);

    if (!Number.isInteger(maxBashCalls) || maxBashCalls < 1) {
      throw new Error(`${label}.maxBashCalls: must be a positive integer`);
    }
  }

  if (stage.maxTurns !== undefined) {
    const maxTurns = Number(stage.maxTurns);

    if (!Number.isInteger(maxTurns) || maxTurns < 1) {
      throw new Error(`${label}.maxTurns: must be a positive integer`);
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

  let stageId: string | undefined;

  if (stage.id !== undefined) {
    if (typeof stage.id !== 'string' || !STAGE_ID_PATTERN.test(stage.id.trim())) {
      throw new Error(`${label}.id: must match ${STAGE_ID_PATTERN}`);
    }

    stageId = stage.id.trim();
  }

  const goto = validateGotoEntries(stage.goto, label, stage);

  let askUser: YahlAskUserEntry[] | undefined;

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
  const agentOverrides = validateAgentOverrides(stage.agentOverrides, label);
  const stagehand = validateStagehandConfig(stage.stagehand, label);

  return {
    logic: logicRaw || '(nixery)',
    ...(nixeryRun ? { nixeryRun } : {}),
    ...(isNixeryStageInput(stage.nixeryInput)
      ? { nixeryInput: normalizeNixeryStageInput(stage.nixeryInput) }
      : {}),
    ...(askUser ? { askUser } : {}),
    ...(agentOverrides ? { agentOverrides } : {}),
    ...(stagehand ? { stagehand } : {}),
    ...(stageId ? { id: stageId } : {}),
    ...(goto ? { goto } : {}),
    ...(stage.contextMode === true ? { contextMode: true } : {}),
    ...(stage.conditionMode === true ? { conditionMode: true } : {}),
    ...(typeof stage.loopSetup === 'string' ? { loopSetup: stage.loopSetup.trim() } : {}),
    ...(stage.temperature !== undefined ? { temperature: Number(stage.temperature) } : {}),
    ...(stage.maxBashCalls !== undefined ? { maxBashCalls: Number(stage.maxBashCalls) } : {}),
    ...(stage.maxTurns !== undefined ? { maxTurns: Number(stage.maxTurns) } : {}),
    ...(isStringArray(stage.contextKeys) ? { contextKeys: stage.contextKeys } : {}),
    ...(isStringArray(stage.updateContextKeys) ? { updateContextKeys: stage.updateContextKeys } : {}),
    ...(isStringArray(stage.produceContextKeys) ? { produceContextKeys: stage.produceContextKeys } : {}),
    ...(isStringArray(stage.produceTypeKeys) ? { produceTypeKeys: stage.produceTypeKeys } : {}),
    ...(verify ? { verify } : {}),
    ...(stage.version !== undefined ? { version: Number(stage.version) } : {}),
  };
};

export const toAgentStage = (stage: YahlStage): YahlStage => {
  const { loopSetup: _loopSetup, verify: _verify, ...rest } = stage;

  return validateYahlStage(rest);
};

export const validateYahlStage = (raw: unknown, index?: number): YahlStage => {
  if (!raw || typeof raw !== 'object') {
    throw new Error(index === undefined ? 'stage: expected an object' : `stages[${index}]: expected an object`);
  }

  return assertStageFields(
    raw as Record<string, unknown>,
    index === undefined ? 'stage' : `stages[${index}]`,
  );
};
