import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

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

  it('renders analysis claims from objects and strings without [object Object]', () => {
    const markdown = structuredKeyToWikiMarkdown('analysis', {
      themes: ['Budget ladder validated'],
      claims: [
        {
          claim: 'Technical blog posts cost $75-200',
          sourceUrls: ['https://www.reddit.com/r/forhire/', 'https://news.ycombinator.com'],
          trustTier: 'high',
        },
        'Resolved: Preferred channel — Show HN first',
      ],
      openQuestions: ['What retainer rate works at $500/mo?'],
      confidence: 'high',
      intentAlignment: 'aligned',
    }, 'marketing-project-yahl-cheap-gigs');

    assert.match(markdown ?? '', /Technical blog posts cost \$75-200/);
    assert.match(markdown ?? '', /\[source\]\(https:\/\/www\.reddit\.com\/r\/forhire\/\)/);
    assert.match(markdown ?? '', /Resolved: Preferred channel — Show HN first/);
    assert.doesNotMatch(markdown ?? '', /\[object Object\]/);
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
