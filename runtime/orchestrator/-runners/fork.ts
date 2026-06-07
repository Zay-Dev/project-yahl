import type { ForkSessionManager } from '@/orchestrator/fork-session-manager';
import type { TReplayStageRow } from '@/orchestrator/fork-session-manager';
import type { TForkSessionSetup } from '@/orchestrator/fork-session-manager';

import { runLoopIteration } from '@/orchestrator/-agent/loop';
import { runYahl } from '@/orchestrator/-agent';
import { createStorage } from '@/orchestrator/-tools/set_context';
import { mergeContextPayloadToStorage } from '@/orchestrator/storage-context';
import { resolveEffectiveStageTemperature } from '@/orchestrator/stage-parse';
import { compileStage } from '@/orchestrator/yahl-parse';
import { initForkSessionManager } from '@/orchestrator/fork-session-manager';

declare global {
  var forkSessionManager: undefined | ForkSessionManager;
}

const _parsedStage = (stage: TForkSessionSetup['stage'] | TReplayStageRow['stage']) =>
  compileStage(stage, 1);

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
      });

      mergeContextPayloadToStorage(storage, step.row.contextAfter);

      continue;
    }

    if (step.setup.stageId === manager.forkSession.anchorStageId) {
      mergeContextPayloadToStorage(storage, step.setup.context);
    }

    const parsed = _parsedStage(step.setup.stage);
    const temperature = resolveEffectiveStageTemperature(parsed, {
      loopMeta: step.setup.loopMeta,
    });

    if (step.setup.loopMeta) {
      await runLoopIteration(parsed, storage, step.setup.loopMeta, runYahl, temperature);

      continue;
    }

    await runYahl('', {
      stages: [parsed],
      temperature,
      useStorage: () => storage,
    });
  }

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
