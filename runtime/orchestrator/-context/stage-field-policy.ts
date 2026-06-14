import type { TChatToolCall, TStorage } from "@/shared/transports/-types";
import type { SetContextToolCallEnvelope } from "@/shared/stage-contract";

import {
  filterContextByKeys,
  filterContextByReadUsage,
  pickContextUpdates,
} from "./context-filter";
import { setContext } from "@/orchestrator/-tools/set_context";

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
  const extraKeys = loopIndexName ? [loopIndexName] : [];

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
  const hasProduceFilter =
    Boolean(stage.produceContextKeys?.length) ||
    Boolean(stage.produceTypeKeys?.length);

  if (hasProduceFilter) {
    return Boolean(
      stage.produceContextKeys?.includes(key) ||
      stage.produceTypeKeys?.includes(key),
    );
  }

  if (stage.updateContextKeys?.length) {
    return stage.updateContextKeys.includes(key);
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
  value === 'set' || value === 'extend';

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
) => {
  if (!_isFastForwardToolCall(toolCall) && !shouldApplySetContext(args.key, stage)) {
    return false;
  }

  const scope = resolveSetContextScope(args.key, stage, args.scope);

  await setContext(storage, {
    ...toolCall,
    function: {
      ...toolCall.function,
      arguments: JSON.stringify({ ...args, scope }),
    },
  });

  return true;
};

export const applySetContextToolCall = async (
  storage: TStorage,
  toolCall: TChatToolCall,
  stage: ParsedStage,
) => {
  const parsed = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
  const argList = _canonicalSetContextArgs(parsed);

  if (argList.length === 0) {
    return false;
  }

  let applied = false;

  for (const args of argList) {
    if (await _applyOneSetContextArg(storage, toolCall, stage, args)) {
      applied = true;
    }
  }

  return applied;
};
