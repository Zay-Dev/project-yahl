export type TKnowledgePersistedIndexItem = {
  absolutePath: string;
  key: string;
  relativePath: string;
};

export type TKnowledgePaths = {
  missionPath?: string;
  persisted?: unknown[];
  studyWorkspace?: string;
  taskSkillsDir?: string;
  topic?: string;
  topicWorkspace?: string;
};

export const isPersistedIndexItem = (
  entry: unknown,
): entry is TKnowledgePersistedIndexItem =>
  typeof entry === 'object'
  && entry !== null
  && typeof (entry as TKnowledgePersistedIndexItem).key === 'string'
  && typeof (entry as TKnowledgePersistedIndexItem).relativePath === 'string'
  && typeof (entry as TKnowledgePersistedIndexItem).absolutePath === 'string';

export const normalizePersistedIndex = (
  entries: unknown[],
): TKnowledgePersistedIndexItem[] =>
  entries.filter(isPersistedIndexItem);

export const appendKnowledgePersistedPath = (
  paths: TKnowledgePaths,
  persistResult: { path?: string } | string | null | undefined,
  key: string,
): TKnowledgePaths => {
  const relativePath = typeof persistResult === 'string'
    ? persistResult.trim()
    : typeof persistResult?.path === 'string'
      ? persistResult.path.trim()
      : '';

  if (!relativePath || !key.trim()) {
    return paths;
  }

  const persisted = normalizePersistedIndex(Array.isArray(paths.persisted) ? paths.persisted : []);
  const entry: TKnowledgePersistedIndexItem = {
    absolutePath: `~/knowledge/${relativePath}`,
    key: key.trim(),
    relativePath,
  };

  const withoutKey = persisted.filter((item) => item.key !== entry.key);

  return {
    ...paths,
    persisted: [...withoutKey, entry].sort((left, right) => left.key.localeCompare(right.key)),
  };
};

export const normalizeKnowledgePathsValue = (value: unknown): unknown => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const paths = value as TKnowledgePaths;

  if (!Array.isArray(paths.persisted)) {
    return value;
  }

  return {
    ...paths,
    persisted: normalizePersistedIndex(paths.persisted),
  };
};
