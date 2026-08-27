import type { TForkSessionStageSetup, TParsedStage, TStageLoopMeta } from './-types';
import type { TResponseStageReplayItem } from './-api-types';

import {
  resetAskUserStageForRerun,
  stripAskUserAnswersFromContext,
} from '@project-yahl/shared/yahl/ask-user-rerun';
import { compileForkRunStage } from '@project-yahl/shared/yahl/stage-compile';
import { dedupeReplayRowsByStageSlot } from '@project-yahl/shared/yahl/replay-dedupe';
import { mergeContextPayloadIntoRecord } from '@project-yahl/shared/yahl/storage-merge';

import { parseSessionYahlTask } from './-parse-session-yahl';

const _countUniqueParsedStageIndices = (rows: { parsedStageIndex?: number }[]) => {
  const seen = new Set<number>();

  for (const row of rows) {
    if (row.parsedStageIndex != null) {
      seen.add(row.parsedStageIndex);
    }
  }

  return seen.size;
};

export class ForkPatchedPipelineError extends Error {}

const _resolveLoopStageIndex = (
  parsedStages: TParsedStage[],
  anchorParsedStageIndex?: number,
) => {
  if (anchorParsedStageIndex != null) {
    const atAnchor = parsedStages[anchorParsedStageIndex];

    if (atAnchor?.type === 'loop' || atAnchor?.type === 'while') {
      return anchorParsedStageIndex;
    }
  }

  return parsedStages.findIndex((stage) => stage.type === 'loop' || stage.type === 'while');
};

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

const _withoutLoopMeta = (setup: TForkSessionStageSetup): TForkSessionStageSetup => {
  const { loopMeta: _loopMeta, ...rest } = setup;

  return rest;
};

const _resolveAnchorParsedStageIndex = (
  replayRows: TResponseStageReplayItem[],
  anchorIndex: number,
  anchorStageId: string,
) => {
  const anchorRow = replayRows.find((row) => row.stageId === anchorStageId)
    ?? replayRows[anchorIndex];

  if (anchorRow?.parsedStageIndex != null) {
    return anchorRow.parsedStageIndex;
  }

  return _countUniqueParsedStageIndices(replayRows.slice(0, anchorIndex));
};

export const resolveAnchorParsedStageIndex = _resolveAnchorParsedStageIndex;

export const deriveForkStorageSeed = (
  replayRows: TResponseStageReplayItem[],
  anchorIndex: number,
  anchorSetup: TForkSessionStageSetup,
) => {
  const prefixRows = dedupeReplayRowsByStageSlot(replayRows.slice(0, anchorIndex));

  let storageSeed: Record<string, unknown> = { context: {}, types: {} };

  for (const row of prefixRows) {
    storageSeed = mergeContextPayloadIntoRecord(storageSeed, row.contextAfter)
      ?? storageSeed;
  }

  if (anchorSetup.context) {
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
  taskId?: string;
  taskYahl: string;
  taskYahlRefs?: Record<string, string>;
}) => {
  const {
    anchorIndex,
    anchorStageId,
    replayRows,
    setups,
    taskId,
    taskYahl,
    taskYahlRefs,
  } = params;
  const baselineStages = parseSessionYahlTask(taskYahl, {
    taskId,
    taskYahlRefs,
  }).stages;
  const nextStages = [...baselineStages];
  const anchorSetup = setups[0];

  if (!anchorSetup) {
    throw new ForkPatchedPipelineError('fork: setups must include the anchor stage');
  }

  const anchorParsedStageIndex = _resolveAnchorParsedStageIndex(
    replayRows,
    anchorIndex,
    anchorStageId,
  );

  if (anchorParsedStageIndex < 0 || anchorParsedStageIndex >= baselineStages.length) {
    throw new ForkPatchedPipelineError(
      `fork: anchor parsedStageIndex ${anchorParsedStageIndex} is out of range `
      + `(stages=${baselineStages.length})`,
    );
  }

  const loopStageIndex = _resolveLoopStageIndex(baselineStages, anchorParsedStageIndex);
  const loopStage = loopStageIndex >= 0 ? baselineStages[loopStageIndex] : undefined;
  const anchorRow = replayRows.find((row) => row.stageId === anchorStageId)
    ?? replayRows[anchorIndex];
  const parentAtAnchor = baselineStages[anchorParsedStageIndex]!;
  const nestedIndexFromMeta = anchorRow?.agentMeta?.nestedIndex;
  const isNestedAnchor = (nestedIndexFromMeta != null
    || Boolean(anchorRow?.agentMeta?.nestedPath?.trim()))
    && Boolean(parentAtAnchor.nestedStages?.length);

  let nestedIndex: number | undefined;

  if (isNestedAnchor) {
    const nestedStages = [...(parentAtAnchor.nestedStages ?? [])];
    const resolvedNestedIndex = nestedIndexFromMeta
      ?? nestedStages.findIndex((stage) => stage.spec.id === anchorSetup.stage.id);

    if (resolvedNestedIndex < 0 || resolvedNestedIndex >= nestedStages.length) {
      throw new ForkPatchedPipelineError(
        `fork: nestedIndex ${resolvedNestedIndex} is out of range `
        + `(nestedStages=${nestedStages.length})`,
      );
    }

    nestedStages[resolvedNestedIndex] = _compileForkSetupParsedStage(
      _withoutLoopMeta(anchorSetup),
      nestedStages,
      resolvedNestedIndex,
      -1,
      undefined,
    );
    nextStages[anchorParsedStageIndex] = {
      ...parentAtAnchor,
      nestedStages,
    };
    nestedIndex = resolvedNestedIndex;
  } else {
    nextStages[anchorParsedStageIndex] = _compileForkSetupParsedStage(
      anchorSetup,
      baselineStages,
      anchorParsedStageIndex,
      loopStageIndex,
      loopStage,
    );
  }

  const seenLater = new Set<number>();

  for (const setup of setups.slice(1)) {
    const parsedStageIndex = setup.parsedStageIndex;

    if (parsedStageIndex == null) {
      throw new ForkPatchedPipelineError('fork: later setup missing parsedStageIndex');
    }

    if (parsedStageIndex <= anchorParsedStageIndex || parsedStageIndex >= nextStages.length) {
      throw new ForkPatchedPipelineError(
        `fork: later parsedStageIndex ${parsedStageIndex} is out of range`,
      );
    }

    if (seenLater.has(parsedStageIndex)) {
      throw new ForkPatchedPipelineError(
        `fork: duplicate later parsedStageIndex ${parsedStageIndex}`,
      );
    }

    seenLater.add(parsedStageIndex);

    nextStages[parsedStageIndex] = _compileForkSetupParsedStage(
      _withoutLoopMeta(setup),
      baselineStages,
      parsedStageIndex,
      loopStageIndex,
      loopStage,
    );
  }

  return {
    anchorParsedStageIndex,
    ...(nestedIndex === undefined ? {} : { nestedIndex }),
    parsedStages: nextStages,
  };
};

export const prefixRowsForForkCopy = (
  replayRows: TResponseStageReplayItem[],
  anchorIndex: number,
) => dedupeReplayRowsByStageSlot(replayRows.slice(0, anchorIndex));
