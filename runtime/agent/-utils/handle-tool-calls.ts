import type { TChatToolCall, TStorage, TToolCallResult } from '@/shared/transports/-types';

export type TToolCallMessage = {
  content: string;
  role: 'tool';
  tool_call_id: string;
};

export const handleToolCalls = async (params: {
  error: (error: Error) => Promise<void>;
  storage: TStorage;
  toolCall: (call: TChatToolCall) => Promise<TToolCallResult>;
  toolCalls: TChatToolCall[];
}) => {
  const toolCallMessages = new Array<TToolCallMessage>();

  for (const call of params.toolCalls) {
    const result = await params.toolCall(call);
    const baseMessage = { role: 'tool' as const, tool_call_id: call.id };

    if (result.hasError) {
      await params.error(new Error(result.result));

      toolCallMessages.push({ ...baseMessage, content: `tool call error: ${result.result}` });

      continue;
    }

    if (result.newStorage) {
      const replace = (key: keyof TStorage) => {
        params.storage[key].clear();

        Object.entries(result.newStorage![key])
          .forEach(([entryKey, value]) => {
            params.storage[key].set(entryKey, value);
          });
      };

      replace('context');
      replace('types');

      toolCallMessages.push({ ...baseMessage, content: 'tool call result: OK' });

      continue;
    }

    toolCallMessages.push({ ...baseMessage, content: result.result });
  }

  return { toolCallMessages };
};
