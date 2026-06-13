import type { ForkSessionManager } from '@/orchestrator/-runners/fork-session-manager';
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

const _parsedStage = (stage: YahlStage) => compileStage(stage, 1);

export const runForkSetups = async (
  manager: ForkSessionManager,
  storage: TStorage,
  options?: { fromSetupIndex?: number },
) => {
  const setups = manager.getSuffixSetups();
  const start = options?.fromSetupIndex ?? 0;

  for (let setupIndex = start; setupIndex < setups.length; setupIndex += 1) {
    const setup = setups[setupIndex]!;

    if (setup.stageId === manager.forkSession.anchorStageId && setup.context) {
      mergeContextPayloadToStorage(
        storage,
        stripAskUserAnswersFromContext(setup.context),
      );
    }

    const stageForRun = resetAskUserStageForRerun(setup.stage);
    const parsed = _parsedStage(stageForRun);
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
        undefined,
        setupIndex,
      );

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
