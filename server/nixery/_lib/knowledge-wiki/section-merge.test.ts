import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  collapseDuplicateWikiSections,
  appendWikiSection,
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

  it('replaces a multi-line Analysis section through EOF without truncating at first line', () => {
    const existing = [
      '## Key facts',
      '',
      '- fact',
      '',
      '## Analysis',
      '',
      '**Themes:**',
      '- old theme',
      '',
      '**Claims:**',
      '- [object Object]',
      '',
      '**Open questions:**',
      '- old gap',
    ].join('\n');

    const merged = mergeWikiSection(existing, 'Analysis', [
      '**Themes:**',
      '- new theme',
      '',
      '**Claims:**',
      '- real claim',
      '',
      '**Open questions:**',
      '- new gap',
    ].join('\n'));

    assert.match(merged, /real claim/);
    assert.match(merged, /new theme/);
    assert.doesNotMatch(merged, /\[object Object\]/);
    assert.doesNotMatch(merged, /old theme/);
    assert.match(merged, /## Key facts/);
  });
});

describe('appendWikiSection', () => {
  it('appends into an existing section body and leaves siblings', () => {
    const existing = [
      '## HOWTO',
      '',
      'step 1',
      '',
      '## Q&A',
      '',
      'old answer',
    ].join('\n');

    const appended = appendWikiSection(existing, 'Q&A', 'new answer');

    assert.match(appended, /old answer/);
    assert.match(appended, /new answer/);
    assert.equal((appended.match(/^## Q&A$/gm) ?? []).length, 1);
    assert.match(appended, /## HOWTO/);
    assert.match(appended, /step 1/);
  });

  it('creates a missing section at the end of the page', () => {
    const existing = '## HOWTO\n\nstep 1\n';
    const appended = appendWikiSection(existing, 'PLACE', '- note');

    assert.match(appended, /## HOWTO/);
    assert.match(appended, /## PLACE/);
    assert.match(appended, /- note/);
  });

  it('creates the section on an empty page', () => {
    const appended = appendWikiSection('', 'Q&A', '**Q:** x\n**A:** y');

    assert.match(appended, /^## Q&A/);
    assert.match(appended, /\*\*Q:\*\* x/);
  });
});
