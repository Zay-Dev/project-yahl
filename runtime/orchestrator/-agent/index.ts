import type { TRunYahl } from './-types';

import { resolveStagesFromText } from '@/orchestrator/yahl-parse';
import { toAgentStage } from '@/shared/yahl-stage';
import { createStorage } from '@/orchestrator/-tools/set_context';
import {
  applySetContextToolCall,
  filterStorageForStage,
} from '@/orchestrator/stage-field-policy';
import { resolveEffectiveStageTemperature } from '@/orchestrator/stage-parse';
import { handleLoop } from './loop';

export const runYahl: TRunYahl = async (
  yahl: string,
  {
    useStorage = () => createStorage(),
    ...options
  } = {},
) => {
  const storage = useStorage();
  const stages = options?.stages ?? resolveStagesFromText(yahl);

  for (const stage of stages) {
    const temperature = resolveEffectiveStageTemperature(stage, {
      loopMeta: options?.loopMeta,
      temperature: options?.temperature,
    });

    if (stage.type === 'loop' && !options?.contextAfter) {
      await handleLoop(stage, storage, runYahl, temperature);
      continue;
    }

    const filteredStorage = filterStorageForStage(
      storage,
      stage.lines,
      stage,
      options?.loopMeta?.indexName,
    );

    const { requestId, wait, getWaitForToolCall } = await publisher.pushRequest(
      filteredStorage,
      toAgentStage(stage.spec),
      temperature,
      {
        contextAfter: options?.contextAfter,
        loopMeta: options?.loopMeta,
        persistedStage: stage.spec,
      },
    );

    const toolCallHandlers = getWaitForToolCall(async (toolCall) => {
      try {
        if (toolCall.function.name === 'set_context') {
          const applied = await applySetContextToolCall(storage, toolCall, stage);

          return {
            hasError: false,
            result: applied ? 'OK' : 'skipped',
            newStorage: storage,
          };
        } else {
          console.log('--toolCall--', toolCall.function.name);
        }
      } catch (error) {
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

    toolCallHandlers.wait();

    await wait();
    toolCallHandlers.dispose();

    const finishContextAfter = options?.contextAfterRecord ?? storage;

    publisher.emitStageFinish({ requestId, contextAfter: finishContextAfter });
  }

  return {
    storage,
  };
};
