export type TModelResponseTag =
  | 'browse'
  | 'stagehand'
  | 'bash'
  | 'tool'
  | 'chat'
  | 'unknown'
  | `platform:${string}`
  | `nixery:${string}`;

const TAG_ORDER: TModelResponseTag[] = [
  'browse',
  'stagehand',
  'bash',
  'tool',
  'chat',
  'unknown',
];

const TOOL_NAME_TAGS: Record<string, TModelResponseTag> = {
  ask_user: 'tool',
  browser: 'browse',
  extend_context: 'tool',
  goto_stage: 'tool',
  nixery: 'tool',
  platform: 'tool',
  read_context_key: 'tool',
  read_type_key: 'tool',
  run_bash: 'bash',
  set_context: 'tool',
  shell: 'bash',
  wiki: 'tool',
  write_workspace_file: 'tool',
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

const nixeryDefTag = (rawArgs: string): `nixery:${string}` | undefined => {
  try {
    const parsed = JSON.parse(rawArgs) as { defId?: unknown };

    if (typeof parsed.defId !== 'string' || !parsed.defId.trim()) {
      return undefined;
    }

    return `nixery:${parsed.defId.trim()}`;
  } catch {
    return undefined;
  }
};

const dropUnknownIfOthers = (tags: Set<TModelResponseTag>) => {
  if (tags.size > 1) {
    tags.delete('unknown');
  }

  return tags;
};

const sortTags = (tags: Set<TModelResponseTag>) => {
  const ordered = TAG_ORDER.filter((tag) => tags.has(tag));
  const extras = [...tags]
    .filter((tag) => !TAG_ORDER.includes(tag))
    .sort();

  return [...ordered, ...extras];
};

const toolCallName = (call: unknown): string | undefined => {
  if (!call || typeof call !== 'object') return undefined;

  const fn = (call as { function?: { name?: unknown } }).function;

  if (!fn || typeof fn !== 'object') return undefined;

  const name = fn.name;

  return typeof name === 'string' && name.trim() ? name.trim() : undefined;
};

const toolCallArguments = (call: unknown): string => {
  if (!call || typeof call !== 'object') return '';

  const fn = (call as { function?: { arguments?: unknown } }).function;

  if (!fn || typeof fn !== 'object') return '';

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
      tags.add('unknown');
      continue;
    }

    const mapped = TOOL_NAME_TAGS[name];

    if (mapped) {
      tags.add(mapped);
    } else {
      tags.add('unknown');
    }

    if (name === 'platform') {
      const skillTag = platformSkillTag(toolCallArguments(call));

      if (skillTag) {
        tags.add(skillTag);
      }
    }

    if (name === 'nixery') {
      const defTag = nixeryDefTag(toolCallArguments(call));

      if (defTag) {
        tags.add(defTag);
      }
    }
  }

  if (tags.size === 0) {
    const content = typeof message.content === 'string' ? message.content.trim() : '';

    return content ? ['chat'] : ['unknown'];
  }

  return sortTags(dropUnknownIfOthers(tags));
};

export const mergeTags = (
  headerTags: string[],
  derived: TModelResponseTag[],
): TModelResponseTag[] => {
  const set = new Set<TModelResponseTag>();

  for (const tag of headerTags) {
    if (tag === 'browse'
      || tag === 'stagehand'
      || tag === 'bash'
      || tag === 'tool'
      || tag === 'chat'
      || tag === 'unknown'
      || tag.startsWith('platform:')
      || tag.startsWith('mastermind:')
      || tag.startsWith('nixery:')) {
      set.add(tag as TModelResponseTag);
    }
  }

  for (const tag of derived) {
    set.add(tag);
  }

  if (set.size === 0) {
    return ['unknown'];
  }

  return sortTags(dropUnknownIfOthers(set));
};
