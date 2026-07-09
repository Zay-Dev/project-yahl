import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mapLegacyKeyToPage, resolveReadPathsForKey } from './legacy-key-map.js';
import { resolvePagesForNeed } from './resolve-pages-for-need.js';
import { mergeWikiSection } from './section-merge.js';
import {
  shouldWriteRawReference,
  structuredKeyToWikiMarkdown,
} from './structured-to-markdown.js';

describe('structured-to-markdown', () => {
  it('renders identity profile as markdown without JSON fence', () => {
    const markdown = structuredKeyToWikiMarkdown('identity', {
      background: 'Engineer in HK',
      languages: ['en', 'zh'],
      preferredName: 'Alex',
      role: 'builder',
      timezone: 'Asia/Hong_Kong',
    }, 'user-onboarding');

    assert.match(markdown ?? '', /Alex/);
    assert.doesNotMatch(markdown ?? '', /```json/);
  });

  it('uses studyMd as study page body', () => {
    const markdown = structuredKeyToWikiMarkdown('study_hk_gov', {
      studyMd: '# Weather notes\n\nRain season peaks in summer.',
      title: 'HK Gov',
      url: 'https://example.com',
    }, 'hk-weather');

    assert.match(markdown ?? '', /Rain season peaks/);
    assert.match(markdown ?? '', /raw\/study_hk_gov/);
  });
});

describe('legacy-key-map', () => {
  it('maps identity to overview section with raw reference', () => {
    const mapping = mapLegacyKeyToPage('identity');

    assert.equal(mapping.page, 'overview');
    assert.equal(mapping.section, 'Identity & background');
    assert.equal(mapping.raw, true);
  });

  it('maps open_questions_qa to raw only', () => {
    const mapping = mapLegacyKeyToPage('open_questions_qa');

    assert.equal(mapping.narrative, false);
    assert.equal(mapping.raw, true);
  });

  it('throws for unknown keys', () => {
    assert.throws(() => mapLegacyKeyToPage('orphan_key'), /unknown key/);
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

describe('mergeWikiSection', () => {
  it('replaces an existing section instead of duplicating headings', () => {
    const merged = mergeWikiSection(
      '## Identity & background\n\nOld name\n\n## Goals & priorities\n\nShip',
      'Identity & background',
      '**Preferred name:** Alex',
    );

    assert.match(merged, /Alex/);
    assert.doesNotMatch(merged, /Old name/);
    assert.match(merged, /Goals & priorities/);
  });
});

describe('shouldWriteRawReference', () => {
  it('skips raw for markdown-only keys', () => {
    assert.equal(
      shouldWriteRawReference('key_facts_md', { content: '# Facts' }),
      false,
    );
  });

  it('writes raw for structured onboarding keys', () => {
    assert.equal(shouldWriteRawReference('identity', { preferredName: 'A' }), true);
  });
});
