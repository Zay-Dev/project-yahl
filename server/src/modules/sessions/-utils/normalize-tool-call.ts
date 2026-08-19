export type TNormalizedToolCall = {
  arguments: unknown;
  id: string;
  name: string;
};

export const resolveToolCallRawArguments = (toolCall: Record<string, unknown>) => {
  const fn = toolCall.function as { arguments?: unknown; name?: string } | undefined;

  if (fn?.arguments !== undefined && fn?.arguments !== null) {
    return fn.arguments;
  }

  if (toolCall.arguments !== undefined && toolCall.arguments !== null) {
    return toolCall.arguments;
  }

  if (typeof toolCall.name === 'string' && toolCall.arguments !== undefined) {
    return toolCall.arguments;
  }

  return undefined;
};

export const resolveToolCallName = (toolCall: Record<string, unknown>, index: number) => {
  const fn = toolCall.function as { name?: string } | undefined;

  if (typeof fn?.name === 'string') {
    return fn.name;
  }

  if (typeof toolCall.name === 'string') {
    return toolCall.name;
  }

  return 'unknown';
};

export const resolveToolCallId = (toolCall: Record<string, unknown>, index: number) =>
  typeof toolCall.id === 'string' ? toolCall.id : `tool-${index}`;

export const parseToolArguments = (raw: unknown) => {
  if (raw === undefined || raw === null) {
    return null;
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }

  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }

  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
};

export const parseToolSummaries = (toolCalls: Record<string, unknown>[]) =>
  toolCalls.map((toolCall, index) => ({
    arguments: parseToolArguments(resolveToolCallRawArguments(toolCall)),
    id: resolveToolCallId(toolCall, index),
    name: resolveToolCallName(toolCall, index),
  }));

export const collectToolResultById = (
  docs: { results?: unknown }[],
) => {
  const byId = new Map<string, string>();

  for (const doc of docs) {
    if (!Array.isArray(doc.results)) {
      continue;
    }

    for (const item of doc.results) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        continue;
      }

      const record = item as { content?: unknown; id?: unknown };

      if (typeof record.id !== 'string' || typeof record.content !== 'string') {
        continue;
      }

      byId.set(record.id, record.content);
    }
  }

  return byId;
};
