import type { ChatToolCall } from '@/shared/stage-tools';

export const getContentText = (content: unknown): string | null => {
  if (typeof content === "string") return content.trim();
  return null;
};

export const getReasoningText = (message: unknown): string | null => {
  if (!message || typeof message !== "object") return null;

  const reasoningValue =
    (message as Record<string, unknown>).reasoning_content;

  if (typeof reasoningValue === "string" || reasoningValue === null) {
    return reasoningValue;
  }

  return null;
};

export const normalizeToolCalls = (raw: unknown): ChatToolCall[] | undefined => {
  if (!Array.isArray(raw)) return undefined;

  const out: ChatToolCall[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;

    const entry = item as Record<string, unknown>;
    const id = typeof entry.id === "string" ? entry.id : "";
    const type = entry.type === "function" ? "function" : null;
    const fn = entry.function;

    if (!type || !fn || typeof fn !== "object") continue;

    const fnObj = fn as Record<string, unknown>;
    const name = typeof fnObj.name === "string" ? fnObj.name : "";
    const args = typeof fnObj.arguments === "string" ? fnObj.arguments : JSON.stringify(fnObj.arguments || {});

    if (!id || !name) continue;

    out.push({
      function: {
        arguments: args,
        name,
      },
      id,
      type: "function",
    });
  }

  return out.length > 0 ? out : undefined;
};
