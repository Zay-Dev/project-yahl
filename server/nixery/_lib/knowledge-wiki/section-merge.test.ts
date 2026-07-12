import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  collapseDuplicateWikiSections,
  mergeWikiSection,
} from './section-merge.js';

describe('collapseDuplicateWikiSections', () => {
  it('keeps the last duplicate ## section block', () => {
    const content = [
      '## Corpus assessment',
      '',
      'old assessment',
      '',
      '## Study plan',
      '',
      'plan v1',
      '',
      '## Corpus assessment',
      '',
      'new assessment',
    ].join('\n');

    const collapsed = collapseDuplicateWikiSections(content, 'Corpus assessment');

    assert.match(collapsed, /new assessment/);
    assert.doesNotMatch(collapsed, /old assessment/);
    assert.match(collapsed, /## Study plan/);
  });

  it('collapses legacy stacked # Key Facts blocks', () => {
    const content = [
      '# project-yahl-develop Key Facts',
      '',
      'stale facts',
      '',
      '# project-yahl-develop Key Facts',
      '',
      'latest facts',
    ].join('\n');

    const collapsed = collapseDuplicateWikiSections(content);

    assert.match(collapsed, /latest facts/);
    assert.doesNotMatch(collapsed, /stale facts/);
    assert.equal((collapsed.match(/# .*(Key Facts|key facts)/g) ?? []).length, 1);
  });

  it('returns content unchanged when no duplicate sections', () => {
    const content = '## Key facts\n\none block only\n';

    assert.equal(collapseDuplicateWikiSections(content, 'Key facts'), content.trim());
  });
});

describe('mergeWikiSection', () => {
  it('replaces an existing section instead of appending a duplicate', () => {
    const existing = [
      '## Key facts',
      '',
      'old bullets',
      '',
      '## Analysis',
      '',
      'old analysis',
    ].join('\n');

    const merged = mergeWikiSection(existing, 'Key facts', 'new bullets');

    assert.match(merged, /new bullets/);
    assert.doesNotMatch(merged, /old bullets/);
    assert.equal((merged.match(/^## Key facts$/gm) ?? []).length, 1);
    assert.match(merged, /## Analysis/);
  });

  it('replaces the first matching section without collapsing other duplicates', () => {
    const existing = [
      '## Corpus assessment',
      '',
      'first',
      '',
      '## Corpus assessment',
      '',
      'second',
    ].join('\n');

    const merged = mergeWikiSection(existing, 'Corpus assessment', 'third');

    assert.match(merged, /third/);
    assert.doesNotMatch(merged, /\bfirst\b/);
    assert.match(merged, /\bsecond\b/);
    assert.equal((merged.match(/^## Corpus assessment$/gm) ?? []).length, 2);
  });
});
