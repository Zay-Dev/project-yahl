import type { TChatToolCall, TStorage } from "@/shared/transports/-types";
import type { SetContextToolCallEnvelope } from "@/shared/stage-contract";

import {
  filterContextByKeys,
  filterContextByReadUsage,
  pickContextUpdates,
} from "./context-filter";
import { setContext } from "./-tools/set_context";

import type { ParsedStage, StageLoopMeta } from "./orchestrator-types";

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

export const applySetContextToolCall = async (
  storage: TStorage,
  toolCall: TChatToolCall,
  stage: ParsedStage,
) => {
  const args = JSON.parse(
    toolCall.function.arguments,
  ) as SetContextToolCallEnvelope["arguments"];

  if (!shouldApplySetContext(args.key, stage)) {
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

export const filterStageContextPayload = (
  stageText: string,
  context: Record<string, unknown>,
  stage: Record<string, unknown>,
  types: Record<string, unknown>,
  parsedStage: ParsedStage,
  loopMeta?: StageLoopMeta,
) => {
  const loopIndex = loopMeta?.indexName
    ?? (loopMeta ? loopIndexNameFromLines(parsedStage.lines) : undefined);

  return {
    context: filterStageBucket(stageText, context, parsedStage, loopIndex),
    stage: filterStageBucket(stageText, stage, parsedStage, loopIndex),
    types: filterStageBucket(stageText, types, parsedStage, loopIndex),
  };
};
