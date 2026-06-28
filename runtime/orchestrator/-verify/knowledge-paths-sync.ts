import type { TStorage } from '@/shared/transports/-types';

import type { TKnowledgePersistedIndexItem } from '@/shared/mastermind-client';
import {
  normalizePersistedIndex,
  type TKnowledgePaths,
} from '@/shared/knowledge-paths';

const mergePersistedEntries = (
  existing: TKnowledgePersistedIndexItem[],
  rebuilt: TKnowledgePersistedIndexItem[],
): TKnowledgePersistedIndexItem[] => {
  const byKey = new Map(existing.map((entry) => [entry.key, entry]));

  for (const entry of rebuilt) {
    byKey.set(entry.key, entry);
  }

  return [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key));
};

export const syncKnowledgePathsPersisted = async (storage: TStorage): Promise<void> => {
  const knowledgePaths = storage.context.get('knowledge_paths');

  if (!knowledgePaths || typeof knowledgePaths !== 'object') {
    return;
  }

  const paths = knowledgePaths as TKnowledgePaths;
  const topic = typeof paths.topic === 'string' ? paths.topic.trim() : '';

  if (!topic) {
    return;
  }

  const { fetchMastermindPersistedIndex } = await import('@/shared/mastermind-client');
  const rebuilt = await fetchMastermindPersistedIndex(topic);

  if (!rebuilt.length) {
    return;
  }

  const existing = normalizePersistedIndex(Array.isArray(paths.persisted) ? paths.persisted : []);
  const merged = mergePersistedEntries(existing, rebuilt);

  storage.context.set('knowledge_paths', {
    ...paths,
    persisted: merged,
  });
};
