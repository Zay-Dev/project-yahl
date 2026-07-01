import type { ForkSessionManager } from './manager';
import type { TStorage } from '@/shared/transports/-types';
import type { YahlStage } from '@/shared/yahl-stage';

import { runLoopIteration } from '@/orchestrator/-agent/loop';
import { runYahl } from '@/orchestrator/-agent';
import {
  resetAskUserStageForRerun,
  stripAskUserAnswersFromContext,
} from '@/orchestrator/-ask-user';
import { mergeContextPayloadToStorage } from '@/orchestrator/-context';
import { resolveEffectiveStageTemperature } from '@/orchestrator/-utils/yahl/stage-parse';
import { compileStage } from '@/orchestrator/-utils/yahl';

import {
  hasMoreLoopIterations,
  resolveLoopStageIndex,
  runPipelineContinuation,
} from '../pipeline-continuation';

const _resolveLoopStageIndex = (manager: ForkSessionManager) =>
  resolveLoopStageIndex({}, manager.parsedStages);

const _parsedStage = (stage: YahlStage, sourceStartLine = 1) =>
  compileStage(stage, sourceStartLine);

export const runForkSetups = async (
  manager: ForkSessionManager,
  storage: TStorage,
  options?: { fromSetupIndex?: number },
) => {
  const setups = manager.getSuffixSetups();
  const start = options?.fromSetupIndex ?? 0;
  const loopStageIndex = _resolveLoopStageIndex(manager);
  const loopStage = loopStageIndex >= 0 ? manager.parsedStages[loopStageIndex] : undefined;

  for (let setupIndex = start; setupIndex < setups.length; setupIndex += 1) {
    const setup = setups[setupIndex]!;

    if (setup.stageId === manager.forkSession.anchorStageId && setup.context) {
      mergeContextPayloadToStorage(
        storage,
        stripAskUserAnswersFromContext(setup.context),
      );
    }

    const stageForRun = resetAskUserStageForRerun(setup.stage);
    const parsed = setup.loopMeta && loopStage
      ? _parsedStage(stageForRun, loopStage.sourceStartLine)
      : _parsedStage(stageForRun);
    const temperature = resolveEffectiveStageTemperature(parsed, {
      loopMeta: setup.loopMeta,
    });

    if (setup.loopMeta) {
      await runLoopIteration(
        parsed,
        storage,
        setup.loopMeta,
        runYahl,
        temperature,
        loopStageIndex >= 0 ? loopStageIndex : undefined,
        setupIndex,
        loopStageIndex >= 0 ? loopStageIndex : undefined,
        manager.parsedStages,
      );

      if (hasMoreLoopIterations(setup.loopMeta) && loopStageIndex >= 0) {
        await runPipelineContinuation({
          loopStageIndex,
          position: {
            kind: 'loopAfterIteration',
            loopMeta: setup.loopMeta,
            loopStageIndex,
          },
          storage,
          suffix: {
            kind: 'forkSetups',
            forkSessionId: manager.forkSession.forkSessionId,
            fromSetupIndex: setupIndex + 1,
          },
          yahlStages: manager.parsedStages,
        });

        return;
      }

      continue;
    }

    await runYahl('', {
      forkSetupIndex: setupIndex,
      stages: [parsed],
      temperature,
      useStorage: () => storage,
    });
  }
};
