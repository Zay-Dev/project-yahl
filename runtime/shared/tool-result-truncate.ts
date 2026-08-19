export const TOOL_RESULT_PERSIST_MAX = 24_000;

export const truncateToolResult = (value: string) =>
  value.length <= TOOL_RESULT_PERSIST_MAX
    ? value
    : `${value.slice(0, TOOL_RESULT_PERSIST_MAX)}\n…[truncated]`;
