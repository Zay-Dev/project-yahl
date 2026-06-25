import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createStorage } from '@/orchestrator/-tools/set_context';

import { syncKnowledgePathsPersisted } from './knowledge-paths-sync.js';

describe('syncKnowledgePathsPersisted', () => {
  it('merges rebuilt persisted entries into knowledge_paths context', async () => {
    const storage = createStorage();
    const originalFetch = globalThis.fetch;

    storage.context.set('knowledge_paths', {
      persisted: [],
      topic: 'demo-topic',
      topicWorkspace: '~/knowledge/demo-topic',
    });

    globalThis.fetch = (async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

      if (url.endsWith('/v1/internal/knowledges/persisted-index')) {
        return Response.json({
          ok: true,
          persisted: [
            {
              absolutePath: '~/knowledges/demo-topic/meta.json',
              key: 'meta',
              relativePath: 'demo-topic/meta.json',
            },
            {
              absolutePath: '~/knowledges/demo-topic/learning_contract.json',
              key: 'learning_contract',
              relativePath: 'demo-topic/learning_contract.json',
            },
          ],
        });
      }

      throw new Error(`unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      await syncKnowledgePathsPersisted(storage);

      const knowledgePaths = storage.context.get('knowledge_paths') as {
        persisted: { key: string }[];
      };

      assert.equal(knowledgePaths.persisted.length, 2);
      assert.deepEqual(
        knowledgePaths.persisted.map((entry) => entry.key).sort(),
        ['learning_contract', 'meta'],
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
