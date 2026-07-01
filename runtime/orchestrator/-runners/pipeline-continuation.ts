import type { TAskUserResumeFrom, TLoopMeta, TStorage } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { TParsedStageSnapshot } from '@/orchestrator/-ask-user/parsed-stage-snapshot';

import { runYahl } from '@/orchestrator/-agent';
import { resumeLoopFromCheckpoint } from '@/orchestrator/-agent/loop';

export type TPipelinePosition =
  | { kind: 'fromStageIndex'; produceKeysResumeAttempt?: boolean; requestId?: string; resumedStage?: ParsedStage; stageIndex: number }
  | { kind: 'loopAfterIteration'; loopMeta: TLoopMeta; loopStageIndex: number }
  | { kind: 'none' }
  | {
    kind: 'resumeStageThenContinue';
    loopMeta?: TLoopMeta;
    requestId: string;
    resumedStage: ParsedStage;
    resumeFrom?: TAskUserResumeFrom;
    stageIndex: number;
  };

export type TPipelineSuffix =
  | { kind: 'forkSetups'; forkSessionId: string; fromSetupIndex: number }
  | { kind: 'parsedStages'; fromStageIndex: number };

export type TPipelineContinuation = {
  loopStageIndex: number | null;
  position: TPipelinePosition;
  storage: TStorage;
  suffix: TPipelineSuffix;
  systemAppend?: string;
  yahlStages: ParsedStage[];
};

export const isLoopStageCheckpoint = (
  loopMeta: TLoopMeta | undefined,
  yahlStages: ParsedStage[],
  stageIndex: number,
) => Boolean(loopMeta && yahlStages[stageIndex]?.type === 'loop');

export const resolveLoopStageIndex = (
  hint: { parsedStageSnapshot?: TParsedStageSnapshot | null },
  yahlStages: ParsedStage[],
) => {
  if (hint.parsedStageSnapshot?.type === 'loop') {
    const match = yahlStages.findIndex((stage) =>
      stage.type === 'loop' && stage.lines === hint.parsedStageSnapshot?.lines);

    if (match >= 0) {
      return match;
    }
  }

  if (hint.parsedStageSnapshot) {
    const match = yahlStages.findIndex((stage) =>
      stage.sourceStartLine === hint.parsedStageSnapshot?.sourceStartLine
      && stage.lines === hint.parsedStageSnapshot?.lines);

    if (match >= 0) {
      return match;
    }
  }

  return yahlStages.findIndex((stage) => stage.type === 'loop');
};

export const hasMoreLoopIterations = (loopMeta: TLoopMeta) =>
  loopMeta.index < loopMeta.arraySnapshot.length - 1;

const _continueLoopIterations = async (
  ctx: TPipelineContinuation,
  loopMeta: TLoopMeta,
  loopStageIndex: number,
) => {
  const loopStage = ctx.yahlStages[loopStageIndex];

  if (!loopStage) {
    throw new Error(`pipeline continuation: missing loop stage at index ${loopStageIndex}`);
  }

  await resumeLoopFromCheckpoint(
    loopStage,
    ctx.storage,
    loopMeta,
    runYahl,
    loopMeta.temperature,
    loopStageIndex,
    loopStageIndex,
    ctx.yahlStages,
  );
};

const _runSuffix = async (ctx: TPipelineContinuation) => {
  if (ctx.suffix.kind === 'parsedStages') {
    const suffix = ctx.yahlStages.slice(ctx.suffix.fromStageIndex);

    if (!suffix.length) {
      return;
    }

    await runYahl('', {
      pipelineStageIndex: ctx.suffix.fromStageIndex,
      stages: suffix,
      startFromStageIndex: 0,
      systemAppend: ctx.systemAppend,
      useStorage: () => ctx.storage,
    });

    return;
  }

  const { initForkSessionManager } = await import('./fork/manager');
  const { runForkSetups } = await import('./fork/setups');

  const manager = await initForkSessionManager(ctx.suffix.forkSessionId);

  await runForkSetups(manager, ctx.storage, {
    fromSetupIndex: ctx.suffix.fromSetupIndex,
  });
};

export const runPipelineContinuation = async (ctx: TPipelineContinuation) => {
  const { position } = ctx;

  if (position.kind === 'fromStageIndex') {
    const { storage } = await runYahl('', {
      ...(position.produceKeysResumeAttempt ? { produceKeysResumeAttempt: true } : {}),
      ...(position.requestId && position.resumedStage
        ? {
          resumeStage: {
            requestId: position.requestId,
            stage: position.resumedStage,
          },
        }
        : {}),
      stages: ctx.yahlStages,
      startFromStageIndex: position.stageIndex,
      systemAppend: ctx.systemAppend,
      useStorage: () => ctx.storage,
    });

    return storage;
  }

  if (position.kind === 'resumeStageThenContinue') {
    const resumeStageInput = {
      loopMeta: position.loopMeta,
      requestId: position.requestId,
      resumeFrom: position.resumeFrom,
      stage: position.resumedStage,
    };

    if (position.loopMeta && isLoopStageCheckpoint(position.loopMeta, ctx.yahlStages, position.stageIndex)) {
      await runYahl('', {
        parsedStageIndex: position.stageIndex,
        pipelineStageIndex: position.stageIndex,
        recoveryStages: ctx.yahlStages,
        resumeStage: resumeStageInput,
        stages: [position.resumedStage],
        startFromStageIndex: 0,
        systemAppend: ctx.systemAppend,
        useStorage: () => ctx.storage,
      });

      await _continueLoopIterations(ctx, position.loopMeta, position.stageIndex);
      await _runSuffix(ctx);

      return ctx.storage;
    }

    const pipelineStages = [
      position.resumedStage,
      ...ctx.yahlStages.slice(position.stageIndex + 1),
    ];

    await runYahl('', {
      pipelineStageIndex: position.stageIndex,
      resumeStage: resumeStageInput,
      stages: pipelineStages,
      startFromStageIndex: 0,
      systemAppend: ctx.systemAppend,
      useStorage: () => ctx.storage,
    });

    return ctx.storage;
  }

  if (position.kind === 'loopAfterIteration') {
    await _continueLoopIterations(ctx, position.loopMeta, position.loopStageIndex);
    await _runSuffix(ctx);

    return ctx.storage;
  }

  if (position.kind === 'none') {
    await _runSuffix(ctx);

    return ctx.storage;
  }

  throw new Error(`pipeline continuation: unsupported position kind ${(position as { kind: string }).kind}`);
};
