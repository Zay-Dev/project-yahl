import type { TChatToolCall, TStorage, TToolCallResult } from '@/shared/transports/-types';

export type TToolCallMessage = {
  content: string;
  role: 'tool';
  tool_call_id: string;
};

export const SET_CONTEXT_OK_TOOL_RESULT =
  'tool call result: OK. That set_context call succeeded and was applied. Do not call set_context again with the same scope/key/value/operation.';

const setContextSuccessContent = (name: string, result: string) => {
  if (name === 'set_context' && result === 'OK') {
    return SET_CONTEXT_OK_TOOL_RESULT;
  }

  return null;
};

export const handleToolCalls = async (params: {
  storage: TStorage;
  toolCall: (call: TChatToolCall) => Promise<TToolCallResult>;
  toolCalls: TChatToolCall[];
}) => {
  const toolCallMessages = new Array<TToolCallMessage>();

  for (const call of params.toolCalls) {
    const result = await params.toolCall(call);
    const baseMessage = { role: 'tool' as const, tool_call_id: call.id };
    const name = call.function.name;

    if (result.hasError) {
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

      toolCallMessages.push({
        ...baseMessage,
        content: setContextSuccessContent(name, result.result || 'OK')
          ?? 'tool call result: OK',
      });

      continue;
    }

    toolCallMessages.push({
      ...baseMessage,
      content: setContextSuccessContent(name, result.result) ?? result.result,
    });
  }

  return { toolCallMessages };
};
