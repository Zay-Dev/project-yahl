import type { TRunYahl } from './-types';

import { resolveStagesFromText } from '@/orchestrator/yahl-parse';
import { createStorage } from '@/orchestrator/-tools/set_context';
import {
  applySetContextToolCall,
  filterStorageForStage,
} from '@/orchestrator/stage-field-policy';

import { handleLoop } from './loop';

export const runYahl: TRunYahl = async (
  yahl: string,
  {
    useStorage = () => createStorage(),
    ...options
  } = {},
) => {
  const storage = useStorage();
  const stages = resolveStagesFromText(yahl);

  for (const stage of stages) {
    const temperature = options?.temperature ?? stage.temperature;

    if (stage.type === 'loop') {
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
      stage.spec,
      temperature,
      { loopMeta: options?.loopMeta },
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
    publisher.emitStageFinish({ requestId, contextAfter: storage });
  }

  return {
    storage,
  };
};
