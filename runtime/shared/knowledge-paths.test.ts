import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  appendKnowledgePersistedPath,
  isPersistedIndexItem,
  normalizeKnowledgePathsValue,
  normalizePersistedIndex,
} from './knowledge-paths.js';

describe('knowledge-paths helpers', () => {
  it('filters non-object persisted entries', () => {
    const normalized = normalizePersistedIndex([
      {
        absolutePath: '~/knowledges/demo/meta.json',
        key: 'meta',
        relativePath: 'demo/meta.json',
      },
      'demo/corpus_assessment.json',
      null,
    ]);

    assert.equal(normalized.length, 1);
    assert.equal(normalized[0]?.key, 'meta');
  });

  it('appends structured persisted entries from persist result path', () => {
    const next = appendKnowledgePersistedPath(
      { persisted: [], topic: 'demo' },
      { path: 'demo/study_plan.json' },
      'study_plan',
    );

    assert.equal(next.persisted?.length, 1);
    assert.deepEqual(next.persisted?.[0], {
      absolutePath: '~/knowledges/demo/study_plan.json',
      key: 'study_plan',
      relativePath: 'demo/study_plan.json',
    });
  });

  it('replaces existing key on append', () => {
    const next = appendKnowledgePersistedPath(
      {
        persisted: [{
          absolutePath: '~/knowledges/demo/study_plan.json',
          key: 'study_plan',
          relativePath: 'demo/study_plan.json',
        }],
        topic: 'demo',
      },
      { path: 'demo/study_plan.json' },
      'study_plan',
    );

    assert.equal(next.persisted?.length, 1);
  });

  it('normalizes knowledge_paths values', () => {
    const normalized = normalizeKnowledgePathsValue({
      persisted: [
        {
          absolutePath: '~/knowledges/demo/meta.json',
          key: 'meta',
          relativePath: 'demo/meta.json',
        },
        'demo/corpus_assessment.json',
      ],
      topic: 'demo',
    }) as { persisted: unknown[] };

    assert.equal(normalized.persisted.length, 1);
    assert.equal(isPersistedIndexItem(normalized.persisted[0]), true);
  });
});
