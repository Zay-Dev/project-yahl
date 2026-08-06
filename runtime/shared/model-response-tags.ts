export const MODEL_RESPONSE_TAGS = ["browse", "stagehand", "bash", "tool", "chat", "unknown"] as const;

export type TModelResponseTag =
  | (typeof MODEL_RESPONSE_TAGS)[number]
  | `platform:${string}`;

const TAG_ORDER: Array<TModelResponseTag | `platform:${string}`> = [
  "browse",
  "stagehand",
  "bash",
  "tool",
  "chat",
  "unknown",
];

const TOOL_NAME_TAGS: Record<string, TModelResponseTag> = {
  ask_user: "tool",
  browser: "browse",
  platform: "tool",
  run_bash: "bash",
  set_context: "tool",
};

const platformSkillTag = (rawArgs: string): `platform:${string}` | undefined => {
  try {
    const parsed = JSON.parse(rawArgs) as { skill?: unknown };

    if (typeof parsed.skill !== 'string' || !parsed.skill.trim()) {
      return undefined;
    }

    return `platform:${parsed.skill.trim()}`;
  } catch {
    return undefined;
  }
};

const sortTags = (tags: Set<TModelResponseTag>) => {
  const ordered = TAG_ORDER.filter((tag) => tags.has(tag as TModelResponseTag));
  const extras = [...tags]
    .filter((tag) => !TAG_ORDER.includes(tag as typeof TAG_ORDER[number]))
    .sort();

  return [...ordered, ...extras];
};

const toolCallName = (call: unknown): string | undefined => {
  if (!call || typeof call !== "object") return undefined;

  const fn = (call as { function?: { name?: unknown } }).function;

  if (!fn || typeof fn !== "object") return undefined;

  const name = fn.name;

  return typeof name === "string" && name.trim() ? name.trim() : undefined;
};

const toolCallArguments = (call: unknown): string => {
  if (!call || typeof call !== "object") return '';

  const fn = (call as { function?: { arguments?: unknown } }).function;

  if (!fn || typeof fn !== "object") return '';

  const args = fn.arguments;

  return typeof args === 'string' ? args : '';
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
    } else {
      tags.add("unknown");
    }

    if (name === 'platform') {
      const skillTag = platformSkillTag(toolCallArguments(call));

      if (skillTag) {
        tags.add(skillTag);
      }
    }
  }

  if (tags.size === 0) {
    const content = typeof message.content === "string" ? message.content.trim() : "";

    return content ? ["chat"] : ["unknown"];
  }

  return sortTags(tags);
};
