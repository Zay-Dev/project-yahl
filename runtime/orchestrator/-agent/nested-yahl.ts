import { randomUUID } from 'crypto';

import type { ChatApiMessage } from '@/shared/stage-tools';
import type { TLoopMeta, TStorage } from './-types';
import type { TRunYahl } from './-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import type { TStageAgentMeta } from '@project-yahl/shared/yahl/types';
import { resolveSubAgentFlag } from '@project-yahl/shared/yahl/logic';
import { asLogicScript } from '@project-yahl/shared/yahl/logic';

import {
  filterStageBucket,
  pickContextUpdates,
  seedDefaultContext,
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

const nestedPathFor = (
  parent: ParsedStage,
  child: ParsedStage,
  index: number,
) => {
  const parentId = parent.spec.id?.trim() || `stage`;
  const childId = child.spec.id?.trim() || String(index);

  return `${parentId}/${childId}`;
};

const toBudgetedNestedStage = (
  parent: ParsedStage,
  child: ParsedStage,
  remainingTurns: number,
  remainingBashCalls: number,
): ParsedStage => {
  const logic = asLogicScript(child.spec.logic);
  const spec = {
    ...child.spec,
    logic,
    maxBashCalls: remainingBashCalls,
    maxTurns: remainingTurns,
    verify: undefined,
    ...(child.spec.goto?.length ? {} : parent.spec.goto?.length ? { goto: parent.spec.goto } : {}),
    ...(child.spec.agentOverrides
      ? {}
      : parent.spec.agentOverrides
        ? { agentOverrides: parent.spec.agentOverrides }
        : {}),
    ...(child.contextKeys?.length
      ? {}
      : parent.contextKeys?.length
        ? { contextKeys: parent.contextKeys }
        : {}),
    ...(child.updateContextKeys?.length
      ? {}
      : parent.updateContextKeys?.length
        ? { updateContextKeys: parent.updateContextKeys }
        : {}),
    ...(child.produceContextKeys?.length
      ? {}
      : parent.produceContextKeys?.length
        ? { produceContextKeys: parent.produceContextKeys }
        : {}),
  };

  return toLoopIterationStage(
    {
      ...child,
      nestedStages: undefined,
      spec,
      ...(spec.contextKeys ? { contextKeys: spec.contextKeys } : {}),
      ...(spec.updateContextKeys ? { updateContextKeys: spec.updateContextKeys } : {}),
      ...(spec.produceContextKeys ? { produceContextKeys: spec.produceContextKeys } : {}),
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

  const isSubAgent = resolveSubAgentFlag(parent.spec) !== false;
  const parentRequestId = extras?.parentRequestId ?? randomUUID();
  let remainingTurns = parent.spec.maxTurns ?? DEFAULT_MAX_TURNS;
  let remainingBashCalls = parent.spec.maxBashCalls ?? DEFAULT_MAX_BASH_CALLS;
  let prefixMessages = extras?.prefixMessages;
  let lastRequestId: string | undefined;
  let totalTurns = 0;
  let totalBashCalls = 0;

  for (let index = 0; index < nestedStages.length; index += 1) {
    const child = nestedStages[index]!;

    if (remainingTurns < 1) {
      break;
    }

    seedDefaultContext(storage);
    seedKnowledgeToScriptNotes(storage);

    const logic = asLogicScript(child.spec.logic);
    const stageInput = filterStageBucket(
      logic,
      Object.fromEntries(storage.context),
      {
        ...child,
        contextKeys: child.contextKeys ?? parent.contextKeys,
        updateContextKeys: child.updateContextKeys ?? parent.updateContextKeys,
        produceContextKeys: child.produceContextKeys ?? parent.produceContextKeys,
      },
    );

    const agentMeta: TStageAgentMeta = {
      isSubAgent,
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
        ...(prefixMessages && !isSubAgent ? { prefixMessages } : {}),
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
        updateContextKeys: child.updateContextKeys ?? parent.updateContextKeys,
        produceContextKeys: child.produceContextKeys ?? parent.produceContextKeys,
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

    if (!isSubAgent && result.requestId) {
      prefixMessages = await loadWarmupPrefixMessages(result.requestId) ?? prefixMessages;
    }
  }

  return {
    requestId: lastRequestId ?? parentRequestId,
    storage,
    usage: { bashCalls: totalBashCalls, turns: totalTurns },
  };
};
