const AGENT_RESULT_KEYS = [
  "success",
  "completed",
  "message",
  "actions",
  "usage",
] as const;

export const normalizeAgentExecuteResult = (result: unknown): unknown => {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return result;
  }

  const record = result as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};

  for (const key of AGENT_RESULT_KEYS) {
    if (key in record) {
      normalized[key] = record[key];
    }
  }

  if (Object.keys(normalized).length > 0) {
    return normalized;
  }

  const { messages: _messages, ...rest } = record;

  return rest;
};
