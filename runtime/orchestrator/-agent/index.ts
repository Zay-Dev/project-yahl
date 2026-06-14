import type { TRunYahl } from './-types';

import { toAgentStage } from '@/shared/yahl-stage';

import { parseYahlFile } from '@/orchestrator/-utils/yahl';
import { createStorage } from '@/orchestrator/-tools/set_context';

import { resolveEffectiveStageTemperature } from '@/orchestrator/-utils/yahl/stage-parse';
import { AskUserPausedError, handleAskUserToolCall } from '@/orchestrator/-ask-user';

import {
  applySetContextToolCall,
  filterStorageForStage,
} from '@/orchestrator/-context';

import { handleLoop } from './loop';

export const runYahl: TRunYahl = async (
  yahl: string,
  {
    useStorage = () => createStorage(),
    ...options
  } = {},
) => {
  const storage = useStorage();
  const startIndex = options?.startFromStageIndex ?? 0;
  const stages = options?.stages ?? parseYahlFile(yahl);

  const sessionId = globalThis.sessionId;
  const agentName = `agent-${sessionId}`;

  for (let stageIndex = startIndex; stageIndex < stages.length; stageIndex += 1) {
    const stage = stages[stageIndex]!;

    const pipelineStageIndex = options?.pipelineStageIndex != null
      ? options.pipelineStageIndex + (stageIndex - startIndex)
      : stageIndex;

    const isResumingThisStage = Boolean(
      options?.resumeStage && stageIndex === startIndex,
    );

    const temperature = resolveEffectiveStageTemperature(stage, {
      loopMeta: options?.loopMeta,
      temperature: options?.temperature,
    });

    if (stage.type === 'loop' && !options?.contextAfter && !isResumingThisStage) {
      await handleLoop(
        stage,
        storage,
        runYahl,
        temperature,
        pipelineStageIndex,
      );
      continue;
    }

    const resumeStage = isResumingThisStage
      ? options.resumeStage
      : undefined;

    const activeStage = resumeStage?.stage ?? stage;
    const stageSpec = activeStage.spec;

    const filteredStorage = filterStorageForStage(
      storage,
      activeStage.lines,
      activeStage,
      options?.loopMeta?.indexName,
    );

    let paused = false;
    let pauseError: AskUserPausedError | null = null;

    const onPause = () => {
      paused = true;
    };

    const { requestId, wait, getWaitForToolCall } = await publisher.pushRequest(
      filteredStorage,
      toAgentStage(stageSpec),
      temperature,
      {
        contextAfter: options?.contextAfter,
        loopMeta: resumeStage?.loopMeta ?? options?.loopMeta,
        persistedStage: stageSpec,
        requestId: resumeStage?.requestId,
        resumeFrom: resumeStage?.resumeFrom,
        skipStageCreate: !!resumeStage,
      },
    );

    await globalThis.sessionTracker?.flush?.();

    const toolCallHandlers = getWaitForToolCall(async (toolCall) => {
      try {
        if (toolCall.function.name === 'set_context') {
          const applied = await applySetContextToolCall(
            storage,
            toolCall,
            activeStage,
          );

          return {
            hasError: false,
            result: applied ? 'OK' : 'skipped',
            newStorage: storage,
          };
        }

        if (toolCall.function.name === 'ask_user') {
          return await handleAskUserToolCall({
            onPause,
            agentName,

            requestId,
            sessionId,

            storage,
            toolCall,

            stage: activeStage,

            forkSetupIndex: options?.forkSetupIndex,
            loopMeta: resumeStage?.loopMeta ?? options?.loopMeta,

            ...(options?.forkSetupIndex != null
              ? {}
              : { stageIndex: pipelineStageIndex }),
          });
        }
      } catch (error) {
        if (error instanceof AskUserPausedError) {
          pauseError = error;
          throw error;
        }

        return {
          hasError: true,
          result: `Error: ${error}`,
        };
      }

      return {
        hasError: true,
        result: `No such tool: ${toolCall.function.name}`,
      };
    });

    const pausePromise = new Promise<never>((_, reject) => {
      const interval = setInterval(() => {
        if (paused || pauseError) {
          clearInterval(interval);
          reject(pauseError ?? new AskUserPausedError());
        }
      }, 50);
    });

    toolCallHandlers.wait();

    try {
      await Promise.race([wait(), pausePromise]);
    } catch (error) {
      toolCallHandlers.dispose();

      if (error instanceof AskUserPausedError) {
        throw error;
      }

      throw error;
    }

    toolCallHandlers.dispose();

    if (options?.resumeStage) {
      options.resumeStage = undefined;
    }

    const finishContextAfter = options?.contextAfterRecord ?? storage;

    publisher.emitStageFinish({ requestId, contextAfter: finishContextAfter });
    await globalThis.sessionTracker?.flush?.();
  }

  return {
    storage,
  };
};
