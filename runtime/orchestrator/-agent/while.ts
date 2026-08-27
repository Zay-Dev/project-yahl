import type { ChatApiMessage } from '@/shared/stage-tools';
import type { TLoopMeta, TRunYahl, TStorage } from './-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import { STAGE_GOTO_REASON_KEY } from '@project-yahl/shared/yahl/stage-goto';
import { parseYahlWhileSetup } from '@project-yahl/shared/yahl/while-setup';
import { seedKnowledgeToScriptNotes } from '@project-yahl/shared/yahl/knowledge-to-script';
import { asLogicScript } from '@project-yahl/shared/yahl/logic';

import { runPredicateScript } from '@/agent/-utils/vm-client';
import {
  filterStageBucket,
  pickContextUpdates,
  seedDefaultContext,
} from '@/orchestrator/-context';
import { toLoopIterationStage } from '@/orchestrator/-utils/yahl';
import { maybePauseForUserRequest } from '@/orchestrator/-control/maybe-pause';

import {
  loadWarmupPrefixForParsedStage,
  loadWarmupPrefixMessages,
} from './warmup-prefix';
import { runNestedYahl } from './nested-yahl';

const DEFAULT_MAX_TURNS = 60;
const DEFAULT_MAX_BASH_CALLS = 24;

export type TWhileRunnerExtras = {
  loadPrefixMessages?: (requestId?: string) => Promise<ChatApiMessage[] | undefined>;
  prefixMessages?: ChatApiMessage[];
  skipWarmUp?: boolean;
  startIteration?: number;
  startNestedIndex?: number;
  systemAppend?: string;
  warmupRequestId?: string;
};

const mergeStageUpdates = (
  stage: ParsedStage,
  storage: TStorage,
  nestedContext: Map<string, unknown>,
) => {
  const isExtends = (key: string) =>
    stage.lines.match(new RegExp(`\\s*EXTENDS:\\s*${key}\\s*=`));

  const keys = [
    ...(stage.updateContextKeys ?? []),
    ...(stage.produceContextKeys ?? []),
  ];

  const updates = pickContextUpdates(
    Object.fromEntries(nestedContext),
    keys.length ? keys : undefined,
  );

  for (const key of Object.keys(updates)) {
    storage.context.set(
      key,
      isExtends(key)
        ? [storage.context.get(key), updates[key]]
        : updates[key],
    );
  }
};

const resolveBudget = (stage: ParsedStage, loopMeta?: TLoopMeta) => ({
  remainingBashCalls: loopMeta?.remainingBashCalls
    ?? stage.spec.maxBashCalls
    ?? DEFAULT_MAX_BASH_CALLS,
  remainingTurns: loopMeta?.remainingTurns
    ?? stage.spec.maxTurns
    ?? DEFAULT_MAX_TURNS,
});

const toBudgetedStage = (
  stage: ParsedStage,
  logic: string,
  remainingTurns: number,
  remainingBashCalls: number,
): ParsedStage => {
  const spec = {
    ...stage.spec,
    logic,
    maxBashCalls: remainingBashCalls,
    maxTurns: remainingTurns,
    verify: undefined,
  };

  return toLoopIterationStage(
    {
      ...stage,
      spec,
    },
    logic,
  );
};

const runWhileSegment = async (
  stage: ParsedStage,
  storage: TStorage,
  logic: string,
  loopMeta: TLoopMeta,
  runner: TRunYahl,
  temperature: number | undefined,
  pipelineStageIndex: number | undefined,
  parsedStageIndex: number | undefined,
  recoveryStages: ParsedStage[] | undefined,
  extras?: {
    prefixMessages?: ChatApiMessage[];
    systemAppend?: string;
  },
) => {
  seedDefaultContext(storage);
  seedKnowledgeToScriptNotes(storage);

  const stageInput = filterStageBucket(
    logic,
    Object.fromEntries(storage.context),
    stage,
  );

  const result = await runner(
    '',
    {
      loopMeta,
      stages: [toBudgetedStage(
        stage,
        logic,
        loopMeta.remainingTurns ?? DEFAULT_MAX_TURNS,
        loopMeta.remainingBashCalls ?? DEFAULT_MAX_BASH_CALLS,
      )],
      temperature,
      ...(pipelineStageIndex === undefined ? {} : { pipelineStageIndex }),
      ...(parsedStageIndex === undefined ? {} : { parsedStageIndex }),
      ...(recoveryStages === undefined ? {} : { recoveryStages }),
      ...(extras?.prefixMessages ? { prefixMessages: extras.prefixMessages } : {}),
      ...(extras?.systemAppend ? { systemAppend: extras.systemAppend } : {}),
      useStorage: () => ({
        context: new Map(Object.entries(stageInput)),
        types: storage.types,
      }),
    },
  );

  mergeStageUpdates(stage, storage, result.storage.context);

  return result;
};

const subtractUsage = (
  remainingTurns: number,
  remainingBashCalls: number,
  usage?: { bashCalls?: number; turns?: number },
) => ({
  remainingBashCalls: Math.max(0, remainingBashCalls - Math.max(0, usage?.bashCalls ?? 0)),
  remainingTurns: Math.max(0, remainingTurns - Math.max(1, usage?.turns ?? 1)),
});

const applySegmentOutcome = (
  storage: TStorage,
  remainingTurns: number,
  remainingBashCalls: number,
  result: Awaited<ReturnType<TRunYahl>>,
) => {
  if (result.gotoTargetStageIndex !== undefined) {
    return { gotoTargetStageIndex: result.gotoTargetStageIndex as number };
  }

  if (storage.context.has(STAGE_GOTO_REASON_KEY)) {
    return { stop: true as const };
  }

  return {
    budget: subtractUsage(remainingTurns, remainingBashCalls, result.usage),
  };
};

const resolveWhileSpec = (stage: ParsedStage) => {
  const parsed = parseYahlWhileSetup(
    stage.spec.whileSetup,
    `stage at line ${stage.sourceStartLine}`,
  );

  if (!parsed) {
    throw new Error(`Invalid while setup occurred in stage at line ${stage.sourceStartLine}`);
  }

  return parsed;
};

export const handleWhile = async (
  stage: ParsedStage,
  storage: TStorage,
  runner: TRunYahl,
  temperature?: number,
  pipelineStageIndex?: number,
  recoveryStages?: ParsedStage[],
  extras?: TWhileRunnerExtras,
) => {
  const { condition, doAtLeast } = resolveWhileSpec(stage);

  let { remainingBashCalls, remainingTurns } = resolveBudget(stage);
  const warmUp = stage.spec.warmUp?.trim();
  const loadPrefix = extras?.loadPrefixMessages ?? loadWarmupPrefixMessages;
  let warmupPrefix = extras?.prefixMessages;
  const startIteration = extras?.startIteration ?? 0;
  const startNestedIndex = extras?.startNestedIndex;
  const isResumeEntry = extras?.startIteration != null || startNestedIndex != null;
  const skipWarmUp = extras?.skipWarmUp === true || isResumeEntry;

  const runBody = (iteration: number, nestedStart?: number) => {
    const loopMeta: TLoopMeta = {
      arraySnapshot: [],
      index: iteration,
      kind: 'while',
      remainingBashCalls,
      remainingTurns,
      temperature,
      value: iteration,
    };

    if (stage.nestedStages?.length) {
      return runNestedYahl(
        stage,
        storage,
        runner,
        temperature,
        pipelineStageIndex,
        recoveryStages,
        {
          loopMeta,
          ...(nestedStart === undefined ? {} : { startNestedIndex: nestedStart }),
          ...(warmupPrefix ? { prefixMessages: warmupPrefix } : {}),
          ...(extras?.systemAppend ? { systemAppend: extras.systemAppend } : {}),
        },
      );
    }

    return runWhileSegment(
      stage,
      storage,
      asLogicScript(stage.spec.logic),
      loopMeta,
      runner,
      temperature,
      pipelineStageIndex,
      pipelineStageIndex,
      recoveryStages,
      {
        ...(warmupPrefix ? { prefixMessages: warmupPrefix } : {}),
        ...(extras?.systemAppend ? { systemAppend: extras.systemAppend } : {}),
      },
    );
  };

  if (warmUp) {
    if (skipWarmUp) {
      warmupPrefix = warmupPrefix
        ?? await loadWarmupPrefixForParsedStage(pipelineStageIndex)
        ?? await loadPrefix(extras?.warmupRequestId);
    } else {
      if (remainingTurns < 1) {
        return {};
      }

      const result = await runWhileSegment(
        stage,
        storage,
        warmUp,
        {
          arraySnapshot: [],
          index: 0,
          kind: 'warmup',
          remainingBashCalls,
          remainingTurns,
          temperature,
          value: null,
        },
        runner,
        temperature,
        pipelineStageIndex,
        pipelineStageIndex,
        recoveryStages,
        extras?.systemAppend ? { systemAppend: extras.systemAppend } : undefined,
      );

      const outcome = applySegmentOutcome(storage, remainingTurns, remainingBashCalls, result);

      if ('gotoTargetStageIndex' in outcome) {
        return { gotoTargetStageIndex: outcome.gotoTargetStageIndex };
      }

      if ('stop' in outcome) {
        return {};
      }

      ({ remainingBashCalls, remainingTurns } = outcome.budget);
      warmupPrefix = warmupPrefix ?? await loadPrefix(result.requestId);
    }
  }

  let iteration = startIteration;
  let lastRequestId: string | undefined;

  while (remainingTurns >= 1) {
    await maybePauseForUserRequest({
      agentName: `agent-${globalThis.sessionId}`,
      loopMeta: {
        arraySnapshot: [],
        index: iteration,
        kind: 'while',
        remainingBashCalls,
        remainingTurns,
        value: null,
      },
      requestId: lastRequestId ?? globalThis.sessionId,
      sessionId: globalThis.sessionId,
      stage,
      ...(pipelineStageIndex === undefined ? {} : { stageIndex: pipelineStageIndex }),
      storage,
    });

    if (iteration >= doAtLeast) {
      if (!(isResumeEntry && iteration === startIteration)) {
        const shouldContinue = await runPredicateScript(condition, storage);

        if (!shouldContinue) {
          break;
        }
      }
    }

    const nestedStart = iteration === startIteration
      ? startNestedIndex
      : undefined;
    const result = await runBody(iteration, nestedStart);
    lastRequestId = result.requestId;
    const outcome = applySegmentOutcome(storage, remainingTurns, remainingBashCalls, result);

    if ('gotoTargetStageIndex' in outcome) {
      return { gotoTargetStageIndex: outcome.gotoTargetStageIndex };
    }

    if ('stop' in outcome) {
      return {};
    }

    ({ remainingBashCalls, remainingTurns } = outcome.budget);
    iteration += 1;
  }

  return {};
};

export const resumeWhileFromCheckpoint = async (
  stage: ParsedStage,
  storage: TStorage,
  completedLoopMeta: TLoopMeta,
  runner: TRunYahl,
  temperature?: number,
  pipelineStageIndex?: number,
  parsedStageIndex?: number,
  recoveryStages?: ParsedStage[],
  extras?: TWhileRunnerExtras,
) => {
  const { condition, doAtLeast } = resolveWhileSpec(stage);

  let { remainingBashCalls, remainingTurns } = resolveBudget(stage, completedLoopMeta);

  ({ remainingBashCalls, remainingTurns } = subtractUsage(
    remainingTurns,
    remainingBashCalls,
    { bashCalls: 0, turns: 0 },
  ));

  const loadPrefix = extras?.loadPrefixMessages ?? loadWarmupPrefixMessages;
  const warmupPrefix = extras?.prefixMessages ?? (
    extras?.warmupRequestId
      ? await loadPrefix(extras.warmupRequestId)
      : await loadWarmupPrefixForParsedStage(parsedStageIndex)
  );

  const runBody = (iteration: number) => {
    const loopMeta: TLoopMeta = {
      arraySnapshot: [],
      index: iteration,
      kind: 'while',
      remainingBashCalls,
      remainingTurns,
      temperature: temperature ?? completedLoopMeta.temperature,
      value: iteration,
    };

    if (stage.nestedStages?.length) {
      return runNestedYahl(
        stage,
        storage,
        runner,
        temperature,
        pipelineStageIndex,
        recoveryStages,
        {
          loopMeta,
          ...(warmupPrefix ? { prefixMessages: warmupPrefix } : {}),
          ...(extras?.systemAppend ? { systemAppend: extras.systemAppend } : {}),
        },
      );
    }

    return runWhileSegment(
      stage,
      storage,
      asLogicScript(stage.spec.logic),
      loopMeta,
      runner,
      temperature,
      pipelineStageIndex,
      parsedStageIndex,
      recoveryStages,
      {
        ...(warmupPrefix ? { prefixMessages: warmupPrefix } : {}),
        ...(extras?.systemAppend ? { systemAppend: extras.systemAppend } : {}),
      },
    );
  };

  let iteration = completedLoopMeta.kind === 'while'
    ? completedLoopMeta.index + 1
    : 0;

  while (remainingTurns >= 1) {
    if (iteration >= doAtLeast) {
      const shouldContinue = await runPredicateScript(condition, storage);

      if (!shouldContinue) {
        break;
      }
    }

    const result = await runBody(iteration);
    const outcome = applySegmentOutcome(storage, remainingTurns, remainingBashCalls, result);

    if ('gotoTargetStageIndex' in outcome) {
      return { gotoTargetStageIndex: outcome.gotoTargetStageIndex };
    }

    if ('stop' in outcome) {
      break;
    }

    ({ remainingBashCalls, remainingTurns } = outcome.budget);
    iteration += 1;
  }

  return {};
};
