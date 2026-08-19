import type { TChatToolCall, TStorage } from "@/shared/transports/-types";
import type {
  ExtendContextToolCallEnvelope,
  SetContextToolCallEnvelope,
} from "@/shared/stage-contract";

import { PLATFORM_CONTEXT_KEYS } from "./default-context";
import {
  filterContextByKeys,
  pickContextUpdates,
} from "./context-filter";
import {
  SET_CONTEXT_EXTEND_RETIRED,
  extendContext,
  setContext,
} from "@/orchestrator/-tools/set_context";

import type { ParsedStage } from "@/orchestrator/-utils/yahl/types";

export { pickContextUpdates };

export const loopIndexNameFromLines = (lines: string) =>
  lines.match(/^\s*for each (\w+) of /i)?.[1];

export const filterStageBucket = (
  stageText: string,
  records: Record<string, unknown>,
  stage: ParsedStage,
  loopIndexName?: string,
) => {
  const extraKeys = [
    ...PLATFORM_CONTEXT_KEYS,
    ...(loopIndexName ? [loopIndexName] : []),
  ];

  return filterContextByKeys(records, stage.contextKeys, extraKeys);
};

export const filterLoopBucket = (
  stageText: string,
  records: Record<string, unknown>,
  stage: ParsedStage,
  indexName: string,
) => filterStageBucket(stageText, records, stage, indexName);

export const shouldApplySetContext = (
  key: string,
  stage: ParsedStage,
) => {
  const produceAllowed = Boolean(
    stage.produceContextKeys?.includes(key) ||
    stage.produceTypeKeys?.includes(key),
  );
  const updateAllowed = Boolean(stage.updateContextKeys?.includes(key));
  const hasProduceFilter =
    Boolean(stage.produceContextKeys?.length) ||
    Boolean(stage.produceTypeKeys?.length);

  if (hasProduceFilter) {
    if (stage.updateContextKeys?.length) {
      return produceAllowed || updateAllowed;
    }

    return produceAllowed;
  }

  if (stage.updateContextKeys?.length) {
    return updateAllowed;
  }

  return true;
};

export const setContextScopeForStage = (
  key: string,
  stage: ParsedStage,
): "global" | "types" => {
  if (stage.produceTypeKeys?.includes(key)) {
    return "types";
  }

  return "global";
};

export const resolveSetContextScope = (
  key: string,
  stage: ParsedStage,
  envelopeScope: SetContextToolCallEnvelope["arguments"]["scope"],
): SetContextToolCallEnvelope["arguments"]["scope"] => {
  if (envelopeScope === "types") {
    return "types";
  }

  return setContextScopeForStage(key, stage);
};

export const filterStorageForStage = (
  storage: TStorage,
  stageText: string,
  stage: ParsedStage,
  loopIndexName?: string,
): TStorage => ({
  context: new Map(
    Object.entries(
      filterStageBucket(
        stageText,
        Object.fromEntries(storage.context),
        stage,
        loopIndexName,
      ),
    ),
  ),
  types: new Map(
    Object.entries(
      filterStageBucket(
        stageText,
        Object.fromEntries(storage.types),
        stage,
        loopIndexName,
      ),
    ),
  ),
});

const _isFastForwardToolCall = (toolCall: TChatToolCall) =>
  toolCall.id.startsWith('fast-forward-');

const _SET_CONTEXT_META_KEYS = new Set(['scope', 'operation']);

const _isSetContextScope = (
  value: unknown,
): value is SetContextToolCallEnvelope['arguments']['scope'] =>
  value === 'global' || value === 'stage' || value === 'types';

const _isSetContextOperation = (
  value: unknown,
): value is SetContextToolCallEnvelope['arguments']['operation'] =>
  value === 'set';

const _canonicalExtendContextArgs = (
  parsed: Record<string, unknown>,
): ExtendContextToolCallEnvelope['arguments'][] => {
  if (typeof parsed.key === 'string' && parsed.key.trim()) {
    return [{
      key: parsed.key.trim(),
      scope: _isSetContextScope(parsed.scope) ? parsed.scope : 'global',
      value: parsed.value,
    }];
  }

  const scope = _isSetContextScope(parsed.scope) ? parsed.scope : 'global';

  return Object.keys(parsed)
    .filter((key) => key !== 'scope' && key !== 'value')
    .map((key) => ({
      key,
      scope,
      value: parsed[key],
    }));
};

const _canonicalSetContextArgs = (
  parsed: Record<string, unknown>,
): SetContextToolCallEnvelope['arguments'][] => {
  if (typeof parsed.key === 'string' && parsed.key.trim()) {
    return [{
      key: parsed.key.trim(),
      operation: _isSetContextOperation(parsed.operation) ? parsed.operation : 'set',
      scope: _isSetContextScope(parsed.scope) ? parsed.scope : 'global',
      value: parsed.value,
    }];
  }

  const scope = _isSetContextScope(parsed.scope) ? parsed.scope : 'global';
  const operation = _isSetContextOperation(parsed.operation) ? parsed.operation : 'set';

  return Object.keys(parsed)
    .filter((key) => !_SET_CONTEXT_META_KEYS.has(key))
    .map((key) => ({
      key,
      operation,
      scope,
      value: parsed[key],
    }));
};

const _applyOneSetContextArg = async (
  storage: TStorage,
  toolCall: TChatToolCall,
  stage: ParsedStage,
  args: SetContextToolCallEnvelope['arguments'],
): Promise<'applied' | 'skipped'> => {
  if (!_isFastForwardToolCall(toolCall) && !shouldApplySetContext(args.key, stage)) {
    return 'skipped';
  }

  const scope = resolveSetContextScope(args.key, stage, args.scope);

  await setContext(storage, {
    ...toolCall,
    function: {
      ...toolCall.function,
      arguments: JSON.stringify({ ...args, scope }),
    },
  });

  return 'applied';
};

export type TApplySetContextResult = {
  applied: boolean;
  invalidJson?: string;
  rejectReason?: string;
};

export const applySetContextToolCall = async (
  storage: TStorage,
  toolCall: TChatToolCall,
  stage: ParsedStage,
): Promise<TApplySetContextResult> => {
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { applied: false, invalidJson: error.message };
    }

    throw error;
  }

  if (parsed.operation === 'extend') {
    return { applied: false, rejectReason: SET_CONTEXT_EXTEND_RETIRED };
  }

  const argList = _canonicalSetContextArgs(parsed);

  if (argList.length === 0) {
    return { applied: false };
  }

  let applied = false;

  for (const args of argList) {
    const outcome = await _applyOneSetContextArg(storage, toolCall, stage, args);

    if (outcome === 'applied') {
      applied = true;
    }
  }

  return { applied };
};

const _applyOneExtendContextArg = async (
  storage: TStorage,
  toolCall: TChatToolCall,
  stage: ParsedStage,
  args: ExtendContextToolCallEnvelope['arguments'],
) => {
  if (!_isFastForwardToolCall(toolCall) && !shouldApplySetContext(args.key, stage)) {
    return false;
  }

  const scope = resolveSetContextScope(args.key, stage, args.scope);

  await extendContext(storage, {
    key: args.key,
    scope: scope === 'types' ? 'types' : 'global',
    value: args.value,
  });

  return true;
};

export type TApplyExtendContextResult = {
  applied: boolean;
  invalidJson?: string;
};

export const applyExtendContextToolCall = async (
  storage: TStorage,
  toolCall: TChatToolCall,
  stage: ParsedStage,
): Promise<TApplyExtendContextResult> => {
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { applied: false, invalidJson: error.message };
    }

    throw error;
  }

  const argList = _canonicalExtendContextArgs(parsed);

  if (argList.length === 0) {
    return { applied: false };
  }

  let applied = false;

  for (const args of argList) {
    if (await _applyOneExtendContextArg(storage, toolCall, stage, args)) {
      applied = true;
    }
  }

  return { applied };
};
