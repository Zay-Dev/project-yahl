import type { ForkSessionManager, TReplayStageRow, TReplayStageVerifyResult } from './manager';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import { runYahl } from '@/orchestrator/-agent';
import { createStorage } from '@/orchestrator/-tools/set_context';
import { mergeContextPayloadToStorage } from '@/orchestrator/-context';
import { resolveEffectiveStageTemperature } from '@/orchestrator/-utils/yahl/stage-parse';
import { compileStage } from '@/orchestrator/-utils/yahl';
import { initForkSessionManager } from './manager';

import { runForkSetups } from './setups';

declare global {
  var forkSessionManager: undefined | ForkSessionManager;
}

const _parsedStage = (stage: TReplayStageRow['stage']) => compileStage(stage, 1);

export const resolvePrefixVerifyFastForward = (
  parsed: ParsedStage,
  verifyResult?: TReplayStageVerifyResult,
) => {
  if (parsed.spec.verify === true && verifyResult?.pass === true) {
    return {
      feedback: verifyResult.feedback,
      score: verifyResult.score,
    };
  }

  return undefined;
};

const _runForkPlan = async (manager: ForkSessionManager) => {
  const plan = manager.buildExecutionPlan();

  if (plan.length === 0) {
    throw new Error('Fork run has no execution steps');
  }

  const storage = createStorage();

  for (const step of plan) {
    if (step.kind === 'fastForward') {
      const contextAfter = manager.contextAfterForPrefixRow(step.row);

      if (!contextAfter) {
        throw new Error(`Missing contextAfter for prefix stage ${step.row.stageId}`);
      }

      const parsed = _parsedStage(step.row.stage);

      const verifyFastForward = resolvePrefixVerifyFastForward(parsed, step.row.verifyResult);

      await runYahl('', {
        contextAfter,
        contextAfterRecord: step.row.contextAfter,
        loopMeta: step.row.loopMeta,
        stages: [parsed],
        temperature: resolveEffectiveStageTemperature(parsed, {
          loopMeta: step.row.loopMeta,
          temperature: step.row.temperature,
        }),
        useStorage: () => storage,
        verifyFastForward,
      });

      mergeContextPayloadToStorage(storage, step.row.contextAfter);

      continue;
    }

    break;
  }

  await runForkSetups(manager, storage);

  return { storage };
};

export const runForkSession = async (
  forkSessionId: string,
  manager = globalThis.forkSessionManager,
) => {
  const resolved = manager ?? await initForkSessionManager(forkSessionId);

  globalThis.forkSessionManager = resolved;

  if (sessionId !== resolved.targetSessionId) {
    throw new Error(
      `Session id mismatch: CLI ${sessionId} vs fork target ${resolved.targetSessionId}`,
    );
  }

  const prefixCount = resolved.getPrefixRows().length;
  const suffixCount = resolved.getSuffixSetups().length;

  console.log(
    `fork-session=${forkSessionId} source=${resolved.sourceSessionId} `
    + `prefix=${prefixCount} suffix=${suffixCount}`,
  );

  if (prefixCount === 0 && suffixCount === 0) {
    throw new Error('Fork run has no prefix rows and no suffix setups to execute');
  }

  return _runForkPlan(resolved);
};
