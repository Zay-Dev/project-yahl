import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mapKnowledgeKeyToPage, resolveReadPathsForKey } from './knowledge-key-map.js';
import { resolvePagesForNeed } from './resolve-pages-for-need.js';

describe('knowledge-key-map', () => {
  it('maps identity to overview section with raw reference', () => {
    const mapping = mapKnowledgeKeyToPage('identity');

    assert.equal(mapping.page, 'overview');
    assert.equal(mapping.section, 'Identity & background');
    assert.equal(mapping.raw, true);
  });

  it('maps open_questions_qa to raw only', () => {
    const mapping = mapKnowledgeKeyToPage('open_questions_qa');

    assert.equal(mapping.narrative, false);
    assert.equal(mapping.raw, true);
  });

  it('throws for unknown keys', () => {
    assert.throws(() => mapKnowledgeKeyToPage('orphan_key'), /unknown key/);
  });

  it('resolveReadPathsForKey includes wiki and raw paths', () => {
    const paths = resolveReadPathsForKey('goals', 'user-onboarding');

    assert.deepEqual(paths, [
      'topics/user-onboarding/overview',
      'topics/user-onboarding/raw/goals',
    ]);
  });
});

describe('resolve-pages-for-need', () => {
  it('maps identity need to overview and raw paths', () => {
    const resolved = resolvePagesForNeed('identity', 'user-onboarding');

    assert.equal(resolved.broad, false);
    assert.ok(resolved.pagePaths.includes('topics/user-onboarding/overview'));
    assert.ok(resolved.pagePaths.includes('topics/user-onboarding/raw/identity'));
  });

  it('treats broad needs as full topic walk', () => {
    const resolved = resolvePagesForNeed('all stage keys', 'user-onboarding');

    assert.equal(resolved.broad, true);
    assert.deepEqual(resolved.pagePaths, ['topics/user-onboarding']);
  });
});
