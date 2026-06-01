import type { TRunYahl } from './-types';

import { yahlToStages } from '@/orchestrator/-utils/yahl';
import { setContext, createStorage } from '@/orchestrator/-tools/set_context';

import { handleLoop } from './loop';

export const runYahl: TRunYahl = async (
  yahl: string,
  {
    useStorage = () => createStorage(),
    ...options
  } = {},
) => {
  const storage = useStorage();
  const stages = yahlToStages(yahl);

  for (const stage of stages) {
    const temperature = options?.temperature ?? stage.temperature;

    if (stage.type === 'loop') {
      await handleLoop(stage.lines, storage, runYahl, temperature);
      continue;
    }

    const { requestId, wait, getWaitForToolCall } = await publisher.pushRequest(
      storage,
      stage.lines,
      temperature,
      { loopMeta: options?.loopMeta },
    );

    const toolCallHandlers = getWaitForToolCall(async (toolCall) => {
      try {
        if (toolCall.function.name === 'set_context') {
          await setContext(storage, toolCall);
          
          return {
            hasError: false,
            result: 'OK',
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