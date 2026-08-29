import type {
  TYahlAgentOverrides,
  TYahlAskUserEntry,
  TYahlFragment,
  TYahlGotoEntry,
  TYahlLogic,
  TYahlLogicRef,
  TYahlStage,
  TYahlStagehandConfig,
  TYahlVerifySpec,
} from './types';
import { persistYahlWhileSetup } from './while-setup';
import { DEFAULT_VERIFY_DEF_ID } from './verify';
import {
  parseStageGotoCommand,
  STAGE_ID_PATTERN,
} from './stage-goto';
import { validateCacheMaxAgeField } from './cache-max-age';
import { validateKnowledgeToScriptField } from './knowledge-to-script';
import {
  assertSafeYahlRefPath,
  isNestedLogic,
  isYahlFragment,
  isYahlLogicRef,
} from './logic';

const LOOP_SETUP_PATTERN = /^\s*for each\s+\w+\s+of\s+\[.*\]\s*$/i;

export type TValidateYahlStageOptions = {
  allowNestedLogic?: boolean;
  labelPrefix?: string;
  nested?: boolean;
};

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

const validateAgentOverrides = (
  raw: unknown,
  label: string,
): TYahlAgentOverrides | undefined => {
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
): TYahlStagehandConfig | undefined => {
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

  const config: TYahlStagehandConfig = {};

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
): TYahlGotoEntry[] | undefined => {
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

  if (entry.skipWarmUp !== undefined && typeof entry.skipWarmUp !== 'boolean') {
    throw new Error(`${label}.verify.skipWarmUp: must be a boolean when present`);
  }

  return {
    defId,
    ...(entry.autoRetry === true ? { autoRetry: true } : {}),
    ...(entry.minScore !== undefined ? { minScore: Number(entry.minScore) } : {}),
    ...(entry.resume === false ? { resume: false } : {}),
    ...(entry.skipWarmUp === false ? { skipWarmUp: false } : {}),
    ...(typeof entry.rubric === 'string' && entry.rubric.trim()
      ? { rubric: entry.rubric.trim() }
      : {}),
  };
};

const validateParallelFields = (stage: Record<string, unknown>, label: string) => {
  let parallelGroup: string | undefined;
  let parallelAfter: string[] | undefined;

  if (stage.parallelGroup !== undefined) {
    if (typeof stage.parallelGroup !== 'string' || !stage.parallelGroup.trim()) {
      throw new Error(`${label}.parallelGroup: must be a non-empty string when present`);
    }

    parallelGroup = stage.parallelGroup.trim();
  }

  if (stage.parallelAfter !== undefined) {
    if (!isStringArray(stage.parallelAfter) || stage.parallelAfter.length === 0) {
      throw new Error(`${label}.parallelAfter: must be a non-empty string array when present`);
    }

    parallelAfter = stage.parallelAfter.map((id) => id.trim()).filter(Boolean);

    if (parallelAfter.length === 0) {
      throw new Error(`${label}.parallelAfter: must be a non-empty string array when present`);
    }
  }

  return { parallelAfter, parallelGroup };
};

const validateLogicValue = (
  raw: unknown,
  label: string,
  options: TValidateYahlStageOptions,
): TYahlLogic => {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();

    if (!trimmed) {
      throw new Error(`${label}.logic: required non-empty string`);
    }

    return trimmed;
  }

  if (options.nested && !options.allowNestedLogic) {
    throw new Error(`${label}.logic: nested fragment stages must use string logic (v1)`);
  }

  if (isYahlLogicRef(raw)) {
    assertSafeYahlRefPath(raw.$ref, `${label}.logic`);

    return { $ref: raw.$ref.trim() } satisfies TYahlLogicRef;
  }

  if (isYahlFragment(raw)) {
    const doc = raw as TYahlFragment & { description?: unknown; name?: unknown };

    if (doc.name !== undefined || doc.description !== undefined) {
      throw new Error(`${label}.logic: fragment must not set name or description`);
    }

    if (!Array.isArray(raw.stages) || raw.stages.length === 0) {
      throw new Error(`${label}.logic.stages: required non-empty array`);
    }

    if (raw.types !== undefined && typeof raw.types !== 'string') {
      throw new Error(`${label}.logic.types: must be a string when present`);
    }

    const stages = raw.stages.map((child, index) =>
      validateYahlStage(child, index, {
        allowNestedLogic: false,
        labelPrefix: `${label}.logic.stages`,
        nested: true,
      }));

    return {
      stages,
      ...(typeof raw.types === 'string' && raw.types.trim()
        ? { types: raw.types.trim() }
        : {}),
    } satisfies TYahlFragment;
  }

  throw new Error(
    `${label}.logic: must be a string, { $ref }, or { stages: [...] }`,
  );
};

const assertStageFields = (
  stage: Record<string, unknown>,
  label: string,
  options: TValidateYahlStageOptions = {},
): TYahlStage => {
  const nixeryRun = typeof stage.nixeryRun === 'string' && stage.nixeryRun.trim()
    ? stage.nixeryRun.trim()
    : undefined;

  let logic: TYahlLogic | undefined;

  if (stage.logic !== undefined) {
    logic = validateLogicValue(stage.logic, label, options);
  }

  const logicScript = typeof logic === 'string' ? logic : '';
  const logicIsNested = isNestedLogic(logic);

  if (!nixeryRun && !logic) {
    throw new Error(`${label}.logic: required (string, { $ref }, or { stages })`);
  }

  if (nixeryRun && logicIsNested) {
    throw new Error(`${label}: nixeryRun cannot combine with nested logic`);
  }

  if (options.nested) {
    if (stage.whileSetup !== undefined || stage.loopSetup !== undefined) {
      throw new Error(`${label}: whileSetup/loopSetup not allowed inside nested YAHL (v1)`);
    }

    if (stage.warmUp !== undefined) {
      throw new Error(`${label}: warmUp not allowed inside nested YAHL (v1)`);
    }

    if (stage.prefixOverride !== undefined) {
      throw new Error(`${label}: prefixOverride not allowed inside nested YAHL (v1)`);
    }
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

    if (stage.whileSetup !== undefined) {
      throw new Error(`${label}: nixeryRun cannot combine with whileSetup`);
    }

    if (stage.warmUp !== undefined) {
      throw new Error(`${label}: nixeryRun cannot combine with warmUp`);
    }

    if (stage.prefixOverride !== undefined) {
      throw new Error(`${label}: nixeryRun cannot combine with prefixOverride`);
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

  const loopSetup = typeof stage.loopSetup === 'string' ? stage.loopSetup.trim() : undefined;
  const whileSetup = persistYahlWhileSetup(stage.whileSetup, label);
  const warmUp = typeof stage.warmUp === 'string' ? stage.warmUp.trim() : undefined;
  const prefixOverride = typeof stage.prefixOverride === 'string'
    ? stage.prefixOverride.trim()
    : undefined;

  if (stage.loopSetup !== undefined) {
    if (!loopSetup || !LOOP_SETUP_PATTERN.test(loopSetup)) {
      throw new Error(`${label}.loopSetup: must match "for each <id> of [...]"`);
    }
  }

  if (stage.warmUp !== undefined && !warmUp) {
    throw new Error(`${label}.warmUp: required non-empty string when present`);
  }

  if (stage.prefixOverride !== undefined && !prefixOverride) {
    throw new Error(`${label}.prefixOverride: required non-empty string when present`);
  }

  if (loopSetup && whileSetup) {
    throw new Error(`${label}: loopSetup and whileSetup are mutually exclusive`);
  }

  if (stage.conditionMode === true && loopSetup) {
    throw new Error(`${label}: conditionMode and loopSetup are mutually exclusive`);
  }

  if (stage.conditionMode === true && whileSetup) {
    throw new Error(`${label}: conditionMode and whileSetup are mutually exclusive`);
  }

  if (warmUp && !loopSetup && !whileSetup) {
    throw new Error(`${label}: warmUp requires loopSetup or whileSetup`);
  }

  if (prefixOverride && !loopSetup && !whileSetup) {
    throw new Error(`${label}: prefixOverride requires loopSetup or whileSetup`);
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

  if (stage.conditionMode === true && !nixeryRun && !logicScript.includes('IF:')) {
    throw new Error(`${label}: conditionMode logic must contain IF:`);
  }

  if (stage.conditionMode === true && logicIsNested) {
    throw new Error(`${label}: conditionMode cannot use nested logic`);
  }

  if (stage.contextMode === true && logicIsNested) {
    throw new Error(`${label}: contextMode cannot use nested logic`);
  }

  let stageId: string | undefined;

  if (stage.id !== undefined) {
    if (typeof stage.id !== 'string' || !STAGE_ID_PATTERN.test(stage.id.trim())) {
      throw new Error(`${label}.id: must match ${STAGE_ID_PATTERN}`);
    }

    stageId = stage.id.trim();
  }

  const goto = validateGotoEntries(stage.goto, label, stage);

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
  const agentOverrides = validateAgentOverrides(stage.agentOverrides, label);
  const stagehand = validateStagehandConfig(stage.stagehand, label);
  const knowledgeToScript = validateKnowledgeToScriptField(stage.knowledgeToScript, label, {
    conditionMode: stage.conditionMode === true,
    contextMode: stage.contextMode === true,
    nixeryRun,
  });
  const cacheMaxAge = validateCacheMaxAgeField(stage.cacheMaxAge, label);
  const { parallelAfter, parallelGroup } = validateParallelFields(stage, label);

  if (cacheMaxAge !== undefined) {
    if (stage.contextMode === true || stage.conditionMode === true || nixeryRun) {
      throw new Error(
        `${label}.cacheMaxAge: only valid on AI stages (not contextMode, conditionMode, or nixeryRun)`,
      );
    }
  }

  if ('subAgent' in stage) {
    throw new Error(`${label}.subAgent: removed; use nested-stage mainThread instead`);
  }

  if (stage.mainThread !== undefined && typeof stage.mainThread !== 'boolean') {
    throw new Error(`${label}.mainThread: must be a boolean when present`);
  }

  if (logicIsNested && stage.mainThread !== undefined) {
    throw new Error(
      `${label}.mainThread: only valid on nested fragment stages, not on fragment/$ref shells`,
    );
  }

  if (!options.nested && stage.mainThread !== undefined) {
    throw new Error(
      `${label}.mainThread: only valid on nested fragment stages`,
    );
  }

  const mainThread = options.nested === true && stage.mainThread === true
    ? true
    : undefined;

  return {
    logic: logic ?? '(nixery)',
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
    ...(loopSetup ? { loopSetup } : {}),
    ...(whileSetup ? { whileSetup } : {}),
    ...(warmUp ? { warmUp } : {}),
    ...(prefixOverride ? { prefixOverride } : {}),
    ...(stage.temperature !== undefined ? { temperature: Number(stage.temperature) } : {}),
    ...(stage.maxBashCalls !== undefined ? { maxBashCalls: Number(stage.maxBashCalls) } : {}),
    ...(stage.maxTurns !== undefined ? { maxTurns: Number(stage.maxTurns) } : {}),
    ...(isStringArray(stage.contextKeys) ? { contextKeys: stage.contextKeys } : {}),
    ...(isStringArray(stage.updateContextKeys) ? { updateContextKeys: stage.updateContextKeys } : {}),
    ...(isStringArray(stage.produceContextKeys) ? { produceContextKeys: stage.produceContextKeys } : {}),
    ...(isStringArray(stage.produceTypeKeys) ? { produceTypeKeys: stage.produceTypeKeys } : {}),
    ...(verify ? { verify } : {}),
    ...(stage.version !== undefined ? { version: Number(stage.version) } : {}),
    ...(knowledgeToScript === false ? { knowledgeToScript: false } : {}),
    ...(knowledgeToScript === true ? { knowledgeToScript: true } : {}),
    ...(cacheMaxAge !== undefined ? { cacheMaxAge } : {}),
    ...(mainThread ? { mainThread: true } : {}),
    ...(parallelGroup ? { parallelGroup } : {}),
    ...(parallelAfter ? { parallelAfter } : {}),
  };
};

export const validateYahlStage = (
  raw: unknown,
  index?: number,
  options: TValidateYahlStageOptions = {},
): TYahlStage => {
  const prefix = options.labelPrefix ?? 'stages';
  const label = index === undefined
    ? (options.labelPrefix ?? 'stage')
    : `${prefix}[${index}]`;

  if (!raw || typeof raw !== 'object') {
    throw new Error(`${label}: expected an object`);
  }

  return assertStageFields(raw as Record<string, unknown>, label, options);
};
