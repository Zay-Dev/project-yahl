import {
  resetAskUserStageForRerun,
  stripAskUserAnswersFromContext,
} from '@project-yahl/shared/yahl/ask-user-rerun';
import { parseYahlTask } from '@project-yahl/shared/yahl/parse-task';
import { compileForkRunStage } from '@project-yahl/shared/yahl/stage-compile';
import { dedupeReplayRowsByStageSlot } from '@project-yahl/shared/yahl/replay-dedupe';
import { mergeContextPayloadIntoRecord } from '@project-yahl/shared/yahl/storage-merge';

import type { TForkSessionStageSetup, TParsedStage, TStageLoopMeta } from './-types';
import type { TResponseStageReplayItem } from './-api-types';

const _countUniqueParsedStageIndices = (rows: { parsedStageIndex?: number }[]) => {
  const seen = new Set<number>();

  for (const row of rows) {
    if (row.parsedStageIndex != null) {
      seen.add(row.parsedStageIndex);
    }
  }

  return seen.size;
};

const _dedupeTailRowsByParsedStageIndex = <T extends { parsedStageIndex?: number }>(rows: T[]) => {
  const seen = new Set<number>();
  const result: T[] = [];

  for (const row of rows) {
    const parsedStageIndex = row.parsedStageIndex;

    if (parsedStageIndex == null || seen.has(parsedStageIndex)) {
      continue;
    }

    seen.add(parsedStageIndex);
    result.push(row);
  }

  return result;
};

export class ForkPatchedPipelineError extends Error {}

const _resolveLoopStageIndex = (parsedStages: TParsedStage[]) =>
  parsedStages.findIndex((stage) => stage.type === 'loop');

const _resolveSetupSourceStartLine = (
  parsedStages: TParsedStage[],
  parsedStageIndex: number,
  setup: TForkSessionStageSetup,
  loopStageIndex: number,
) => {
  const fromSlot = parsedStages[parsedStageIndex]?.sourceStartLine;

  if (fromSlot != null) {
    return fromSlot;
  }

  if (setup.loopMeta && loopStageIndex >= 0) {
    return parsedStages[loopStageIndex]?.sourceStartLine ?? 1;
  }

  return 1;
};

const _normalizeForkSetupForCompile = (
  setup: TForkSessionStageSetup,
): TForkSessionStageSetup => {
  const stage = resetAskUserStageForRerun(setup.stage);

  if (stage.temperature !== undefined) {
    return { ...setup, stage };
  }

  if (!setup.loopMeta || setup.loopMeta.temperature === undefined) {
    return { ...setup, stage };
  }

  const { temperature: _temperature, ...loopMeta } = setup.loopMeta;

  return { ...setup, loopMeta, stage };
};

const _stripCompiledTemperature = (parsed: TParsedStage): TParsedStage => {
  const { temperature: _specTemperature, ...spec } = parsed.spec;
  const { temperature: _parsedTemperature, ...parsedRest } = parsed;

  return {
    ...parsedRest,
    spec,
  };
};

const _compileForkSetupParsedStage = (
  setup: TForkSessionStageSetup,
  parsedStages: TParsedStage[],
  parsedStageIndex: number,
  loopStageIndex: number,
  loopStage: TParsedStage | undefined,
) => {
  const normalized = _normalizeForkSetupForCompile(setup);
  const sourceStartLine = _resolveSetupSourceStartLine(
    parsedStages,
    parsedStageIndex,
    normalized,
    loopStageIndex,
  );

  const compiled = normalized.loopMeta && loopStage
    ? compileForkRunStage(
      normalized.stage,
      normalized.loopMeta as TStageLoopMeta,
      loopStage.sourceStartLine,
    )
    : compileForkRunStage(normalized.stage, undefined, sourceStartLine);

  return normalized.stage.temperature === undefined
    ? _stripCompiledTemperature(compiled)
    : compiled;
};

const _setupFromReplayRow = (replayRow: TResponseStageReplayItem): TForkSessionStageSetup => ({
  context: replayRow.context ?? {},
  loopMeta: replayRow.loopMeta,
  stage: replayRow.stage,
  stageId: replayRow.stageId,
});

export const deriveForkStorageSeed = (
  replayRows: TResponseStageReplayItem[],
  anchorIndex: number,
  anchorSetup: TForkSessionStageSetup,
) => {
  const prefixRows = dedupeReplayRowsByStageSlot(replayRows.slice(0, anchorIndex));
  const lastPrefix = prefixRows.at(-1);

  let storageSeed: Record<string, unknown> = lastPrefix?.contextAfter
    ? { ...lastPrefix.contextAfter }
    : { context: {}, types: {} };

  if (anchorSetup.stageId === anchorSetup.stageId && anchorSetup.context) {
    storageSeed = mergeContextPayloadIntoRecord(
      storageSeed,
      stripAskUserAnswersFromContext(anchorSetup.context) ?? {},
    ) ?? storageSeed;
  }

  return storageSeed;
};

export const buildForkPatchedParsedStages = (params: {
  anchorIndex: number;
  anchorStageId: string;
  replayRows: TResponseStageReplayItem[];
  setups: TForkSessionStageSetup[];
  taskYahl: string;
}) => {
  const { anchorIndex, anchorStageId, replayRows, setups, taskYahl } = params;
  const baselineStages = parseYahlTask(taskYahl).stages;
  const nextStages = [...baselineStages];

  const anchorSlotOrdinal = _countUniqueParsedStageIndices(replayRows.slice(0, anchorIndex));
  const tailDeduped = _dedupeTailRowsByParsedStageIndex(replayRows.slice(anchorIndex));

  if (anchorSlotOrdinal + tailDeduped.length > baselineStages.length) {
    throw new ForkPatchedPipelineError(
      `fork: tail slots exceed parsedStages length `
      + `(anchor=${anchorSlotOrdinal} tail=${tailDeduped.length} stages=${baselineStages.length})`,
    );
  }

  const anchorInTail = tailDeduped.some((row) => row.stageId === anchorStageId);

  if (!anchorInTail) {
    throw new ForkPatchedPipelineError(`fork: anchor stage ${anchorStageId} not found in tail slots`);
  }

  const setupByStageId = new Map(setups.map((setup) => [setup.stageId, setup]));
  const loopStageIndex = _resolveLoopStageIndex(baselineStages);
  const loopStage = loopStageIndex >= 0 ? baselineStages[loopStageIndex] : undefined;

  for (let slotIndex = 0; slotIndex < tailDeduped.length; slotIndex += 1) {
    const replayRow = tailDeduped[slotIndex]!;
    const parsedStageIndex = anchorSlotOrdinal + slotIndex;
    const setup = setupByStageId.get(replayRow.stageId) ?? _setupFromReplayRow(replayRow);

    nextStages[parsedStageIndex] = _compileForkSetupParsedStage(
      setup,
      baselineStages,
      parsedStageIndex,
      loopStageIndex,
      loopStage,
    );
  }

  return {
    anchorParsedStageIndex: anchorSlotOrdinal,
    parsedStages: nextStages,
  };
};

export const prefixRowsForForkCopy = (
  replayRows: TResponseStageReplayItem[],
  anchorIndex: number,
) => dedupeReplayRowsByStageSlot(replayRows.slice(0, anchorIndex));
