import { randomUUID } from 'crypto';

import type { ChatApiMessage } from '@/shared/stage-tools';
import type { TLoopMeta, TStorage } from './-types';
import type { TRunYahl } from './-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import type { TStageAgentMeta } from '@project-yahl/shared/yahl/types';
import { resolveMainThreadFlag } from '@project-yahl/shared/yahl/logic';
import { asLogicScript } from '@project-yahl/shared/yahl/logic';

import {
  filterStageBucket,
  pickContextUpdates,
  seedDefaultContext,
  PLATFORM_CONTEXT_KEYS,
} from '@/orchestrator/-context';
import { toLoopIterationStage } from '@/orchestrator/-utils/yahl';
import { seedKnowledgeToScriptNotes } from '@project-yahl/shared/yahl/knowledge-to-script';
import { STAGE_GOTO_REASON_KEY } from '@project-yahl/shared/yahl/stage-goto';

import { loadWarmupPrefixMessages } from './warmup-prefix';

const DEFAULT_MAX_TURNS = 60;
const DEFAULT_MAX_BASH_CALLS = 24;

export type TNestedYahlExtras = {
  loopMeta?: TLoopMeta;
  parentRequestId?: string;
  prefixMessages?: ChatApiMessage[];
  startNestedIndex?: number;
  systemAppend?: string;
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

  if (!keys.length) {
    return;
  }

  const updates = pickContextUpdates(Object.fromEntries(nestedContext), keys);

  for (const key of Object.keys(updates)) {
    storage.context.set(
      key,
      isExtends(key)
        ? [storage.context.get(key), updates[key]]
        : updates[key],
    );
  }
};

const nestedPathFor = (
  parent: ParsedStage,
  child: ParsedStage,
  index: number,
) => {
  const parentId = parent.spec.id?.trim() || `stage`;
  const childId = child.spec.id?.trim() || String(index);

  return `${parentId}/${childId}`;
};

const childContextKeys = (child: ParsedStage): string[] =>
  child.contextKeys?.length
    ? child.contextKeys
    : child.spec.contextKeys?.length
      ? child.spec.contextKeys
      : [...PLATFORM_CONTEXT_KEYS];

const toBudgetedNestedStage = (
  parent: ParsedStage,
  child: ParsedStage,
  remainingTurns: number,
  remainingBashCalls: number,
): ParsedStage => {
  const logic = asLogicScript(child.spec.logic);
  const turnsCap = child.spec.maxTurns != null
    ? Math.min(child.spec.maxTurns, remainingTurns)
    : remainingTurns;
  const bashCap = child.spec.maxBashCalls != null
    ? Math.min(child.spec.maxBashCalls, remainingBashCalls)
    : remainingBashCalls;
  const contextKeys = childContextKeys(child);
  const updateContextKeys = child.updateContextKeys
    ?? child.spec.updateContextKeys;
  const produceContextKeys = child.produceContextKeys
    ?? child.spec.produceContextKeys;

  const spec = {
    ...child.spec,
    logic,
    maxBashCalls: bashCap,
    maxTurns: turnsCap,
    verify: undefined,
    contextKeys,
    ...(updateContextKeys?.length ? { updateContextKeys } : {}),
    ...(produceContextKeys?.length ? { produceContextKeys } : {}),
    ...(child.spec.goto?.length
      ? {}
      : parent.spec.goto?.length
        ? { goto: parent.spec.goto }
        : {}),
    ...(child.spec.agentOverrides
      ? {}
      : parent.spec.agentOverrides
        ? { agentOverrides: parent.spec.agentOverrides }
        : {}),
  };

  return toLoopIterationStage(
    {
      ...child,
      nestedStages: undefined,
      spec,
      contextKeys,
      ...(updateContextKeys?.length ? { updateContextKeys } : {}),
      ...(produceContextKeys?.length ? { produceContextKeys } : {}),
    },
    logic,
  );
};

export const runNestedYahl = async (
  parent: ParsedStage,
  storage: TStorage,
  runner: TRunYahl,
  temperature: number | undefined,
  pipelineStageIndex: number | undefined,
  recoveryStages: ParsedStage[] | undefined,
  extras?: TNestedYahlExtras,
) => {
  const nestedStages = parent.nestedStages ?? [];

  if (!nestedStages.length) {
    throw new Error('runNestedYahl: parent has no nestedStages');
  }

  const parentRequestId = extras?.parentRequestId ?? randomUUID();
  const warmupPrefix = extras?.prefixMessages;
  let mainThreadPrefix = warmupPrefix;
  let remainingTurns = parent.spec.maxTurns ?? DEFAULT_MAX_TURNS;
  let remainingBashCalls = parent.spec.maxBashCalls ?? DEFAULT_MAX_BASH_CALLS;
  let lastRequestId: string | undefined;
  let totalTurns = 0;
  let totalBashCalls = 0;

  for (let index = 0; index < nestedStages.length; index += 1) {
    if (index < (extras?.startNestedIndex ?? 0)) {
      continue;
    }

    const child = nestedStages[index]!;

    if (remainingTurns < 1) {
      break;
    }

    seedDefaultContext(storage);
    seedKnowledgeToScriptNotes(storage);

    const onMainThread = resolveMainThreadFlag(child.spec);
    const logic = asLogicScript(child.spec.logic);
    const contextKeys = childContextKeys(child);
    const updateContextKeys = child.updateContextKeys
      ?? child.spec.updateContextKeys;
    const produceContextKeys = child.produceContextKeys
      ?? child.spec.produceContextKeys;

    const stageInput = filterStageBucket(
      logic,
      Object.fromEntries(storage.context),
      {
        ...child,
        contextKeys,
        ...(updateContextKeys?.length ? { updateContextKeys } : {}),
        ...(produceContextKeys?.length ? { produceContextKeys } : {}),
      },
    );

    const childPrefix = onMainThread
      ? mainThreadPrefix
      : warmupPrefix;

    const agentMeta: TStageAgentMeta = {
      isMainThread: onMainThread,
      nestedIndex: index,
      nestedPath: nestedPathFor(parent, child, index),
      parentRequestId,
      ...(parent.spec.parallelGroup
        ? { parallelGroupId: parent.spec.parallelGroup }
        : {}),
    };

    const result = await runner(
      '',
      {
        agentMeta,
        loopMeta: extras?.loopMeta,
        stages: [toBudgetedNestedStage(parent, child, remainingTurns, remainingBashCalls)],
        temperature: child.temperature ?? temperature,
        ...(pipelineStageIndex === undefined ? {} : { pipelineStageIndex }),
        ...(pipelineStageIndex === undefined ? {} : { parsedStageIndex: pipelineStageIndex }),
        ...(recoveryStages === undefined ? {} : { recoveryStages }),
        ...(childPrefix?.length ? { prefixMessages: childPrefix } : {}),
        ...(extras?.systemAppend ? { systemAppend: extras.systemAppend } : {}),
        useStorage: () => ({
          context: new Map(Object.entries(stageInput)),
          types: storage.types,
        }),
      },
    );

    mergeStageUpdates(
      {
        ...child,
        ...(updateContextKeys?.length ? { updateContextKeys } : { updateContextKeys: [] }),
        ...(produceContextKeys?.length ? { produceContextKeys } : { produceContextKeys: [] }),
      },
      storage,
      result.storage.context,
    );

    lastRequestId = result.requestId;
    totalTurns += result.usage?.turns ?? 1;
    totalBashCalls += result.usage?.bashCalls ?? 0;
    remainingTurns = Math.max(0, remainingTurns - Math.max(1, result.usage?.turns ?? 1));
    remainingBashCalls = Math.max(
      0,
      remainingBashCalls - Math.max(0, result.usage?.bashCalls ?? 0),
    );

    if (result.gotoTargetStageIndex !== undefined) {
      return {
        gotoTargetStageIndex: result.gotoTargetStageIndex,
        requestId: lastRequestId,
        storage,
        usage: { bashCalls: totalBashCalls, turns: totalTurns },
      };
    }

    if (storage.context.has(STAGE_GOTO_REASON_KEY)) {
      return {
        requestId: lastRequestId,
        storage,
        usage: { bashCalls: totalBashCalls, turns: totalTurns },
      };
    }

    if (onMainThread && result.requestId) {
      mainThreadPrefix = await loadWarmupPrefixMessages(result.requestId)
        ?? mainThreadPrefix;
    }
  }

  return {
    requestId: lastRequestId ?? parentRequestId,
    storage,
    usage: { bashCalls: totalBashCalls, turns: totalTurns },
  };
};
