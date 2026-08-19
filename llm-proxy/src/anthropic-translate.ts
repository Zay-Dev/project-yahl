type TOpenAiMessage = {
  content?: unknown;
  role?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    function?: { arguments?: string; name?: string };
    id?: string;
    type?: string;
  }>;
};

type TOpenAiTool = {
  function?: {
    description?: string;
    name?: string;
    parameters?: Record<string, unknown>;
  };
  type?: string;
};

const textFromContent = (content: unknown): string => {
  if (typeof content === 'string') return content;

  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return '';

      const record = part as { text?: unknown; type?: unknown };

      if (record.type === 'text' && typeof record.text === 'string') {
        return record.text;
      }

      return '';
    })
    .filter(Boolean)
    .join('\n');
};

export const openAiBodyToAnthropic = (body: Record<string, unknown>) => {
  const messages = Array.isArray(body.messages) ? body.messages as TOpenAiMessage[] : [];
  const systemParts: string[] = [];
  const anthropicMessages: Array<Record<string, unknown>> = [];

  for (const message of messages) {
    const role = message.role;

    if (role === 'system') {
      const text = textFromContent(message.content);

      if (text) systemParts.push(text);
      continue;
    }

    if (role === 'tool') {
      anthropicMessages.push({
        content: [{
          content: textFromContent(message.content),
          tool_use_id: message.tool_call_id,
          type: 'tool_result',
        }],
        role: 'user',
      });
      continue;
    }

    if (role === 'assistant' && Array.isArray(message.tool_calls) && message.tool_calls.length) {
      const content: Array<Record<string, unknown>> = [];
      const text = textFromContent(message.content);

      if (text) {
        content.push({ text, type: 'text' });
      }

      for (const call of message.tool_calls) {
        let input: unknown = {};

        try {
          input = JSON.parse(call.function?.arguments || '{}');
        } catch {
          input = {};
        }

        content.push({
          id: call.id,
          input,
          name: call.function?.name,
          type: 'tool_use',
        });
      }

      anthropicMessages.push({ content, role: 'assistant' });
      continue;
    }

    if (role === 'user' || role === 'assistant') {
      anthropicMessages.push({
        content: textFromContent(message.content),
        role,
      });
    }
  }

  const tools = Array.isArray(body.tools)
    ? (body.tools as TOpenAiTool[])
      .filter((tool) => tool.type === 'function' && tool.function?.name)
      .map((tool) => ({
        description: tool.function?.description,
        input_schema: tool.function?.parameters ?? { type: 'object', properties: {} },
        name: tool.function!.name!,
      }))
    : undefined;

  const toolChoice = body.tool_choice;
  let anthropicToolChoice: unknown;

  if (toolChoice === 'auto' || toolChoice === undefined) {
    anthropicToolChoice = tools?.length ? { type: 'auto' } : undefined;
  } else if (toolChoice === 'none') {
    anthropicToolChoice = { type: 'none' };
  } else if (toolChoice === 'required') {
    anthropicToolChoice = { type: 'any' };
  } else if (toolChoice && typeof toolChoice === 'object' && !Array.isArray(toolChoice)) {
    const named = (toolChoice as { function?: { name?: string } }).function?.name;

    if (named) {
      anthropicToolChoice = { name: named, type: 'tool' };
    }
  }

  return {
    max_tokens: typeof body.max_tokens === 'number' ? body.max_tokens : 4096,
    messages: anthropicMessages,
    model: body.model,
    ...(systemParts.length ? { system: systemParts.join('\n\n') } : {}),
    ...(typeof body.temperature === 'number' ? { temperature: body.temperature } : {}),
    ...(tools?.length ? { tools } : {}),
    ...(anthropicToolChoice ? { tool_choice: anthropicToolChoice } : {}),
  };
};

export const anthropicResponseToOpenAi = (
  anthropic: Record<string, unknown>,
  modelFallback?: unknown,
): Record<string, unknown> => {
  const contentBlocks = Array.isArray(anthropic.content) ? anthropic.content : [];
  const textParts: string[] = [];
  const toolCalls: Array<Record<string, unknown>> = [];

  for (const block of contentBlocks) {
    if (!block || typeof block !== 'object') continue;

    const record = block as Record<string, unknown>;

    if (record.type === 'text' && typeof record.text === 'string') {
      textParts.push(record.text);
      continue;
    }

    if (record.type === 'tool_use') {
      toolCalls.push({
        function: {
          arguments: JSON.stringify(record.input ?? {}),
          name: record.name,
        },
        id: record.id,
        type: 'function',
      });
    }
  }

  const usage = anthropic.usage && typeof anthropic.usage === 'object'
    ? anthropic.usage as Record<string, unknown>
    : undefined;

  return {
    choices: [{
      finish_reason: toolCalls.length
        ? 'tool_calls'
        : anthropic.stop_reason === 'max_tokens'
          ? 'length'
          : 'stop',
      index: 0,
      message: {
        content: textParts.join('\n') || null,
        role: 'assistant',
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      },
    }],
    created: Math.floor(Date.now() / 1000),
    id: typeof anthropic.id === 'string' ? anthropic.id : `chatcmpl-${Date.now()}`,
    model: typeof anthropic.model === 'string'
      ? anthropic.model
      : typeof modelFallback === 'string'
        ? modelFallback
        : 'unknown',
    object: 'chat.completion',
    usage: usage
      ? {
        completion_tokens: Number(usage.output_tokens ?? 0),
        prompt_tokens: Number(usage.input_tokens ?? 0),
        total_tokens: Number(usage.input_tokens ?? 0) + Number(usage.output_tokens ?? 0),
      }
      : undefined,
  };
};
