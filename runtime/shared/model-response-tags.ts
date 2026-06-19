export const MODEL_RESPONSE_TAGS = ["browse", "bash", "tool", "chat", "unknown"] as const;

export type TModelResponseTag = (typeof MODEL_RESPONSE_TAGS)[number];

const TAG_ORDER: TModelResponseTag[] = ["browse", "bash", "tool", "chat", "unknown"];

const TOOL_NAME_TAGS: Record<string, TModelResponseTag> = {
  ask_user: "tool",
  browser: "browse",
  rag: "tool",
  run_bash: "bash",
  set_context: "tool",
};

const sortTags = (tags: Set<TModelResponseTag>) =>
  TAG_ORDER.filter((tag) => tags.has(tag));

const toolCallName = (call: unknown): string | undefined => {
  if (!call || typeof call !== "object") return undefined;

  const fn = (call as { function?: { name?: unknown } }).function;

  if (!fn || typeof fn !== "object") return undefined;

  const name = fn.name;

  return typeof name === "string" && name.trim() ? name.trim() : undefined;
};

type TToolCallMessage = {
  content?: string | null;
  tool_calls?: unknown[];
};

export const deriveModelResponseTags = (message: TToolCallMessage): TModelResponseTag[] => {
  const toolCalls = message.tool_calls ?? [];
  const tags = new Set<TModelResponseTag>();

  for (const call of toolCalls) {
    const name = toolCallName(call);

    if (!name) {
      tags.add("unknown");
      continue;
    }

    const mapped = TOOL_NAME_TAGS[name];

    if (mapped) {
      tags.add(mapped);
      continue;
    }

    tags.add("unknown");
  }

  if (tags.size === 0) {
    const content = typeof message.content === "string" ? message.content.trim() : "";

    return content ? ["chat"] : ["unknown"];
  }

  return sortTags(tags);
};
