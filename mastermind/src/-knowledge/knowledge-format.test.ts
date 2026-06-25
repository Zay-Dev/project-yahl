import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  measurePersistPayloadBytes,
  resolveKnowledgeFileExtension,
  serializeMarkdownBody,
  shouldPersistAsMarkdown,
} from './knowledge-format.js';

describe('knowledge-format', () => {
  it('routes narrative keys to markdown', () => {
    assert.equal(shouldPersistAsMarkdown('key_facts_md', { content: '# Facts' }), true);
    assert.equal(shouldPersistAsMarkdown('background_summary', 'Short bio'), true);
    assert.equal(shouldPersistAsMarkdown('user_profile_summary', {
      agent: 'agent profile',
      mastermind: 'mastermind profile',
    }), true);
    assert.equal(resolveKnowledgeFileExtension('analysis_md', { content: 'body' }), '.md');
  });

  it('keeps structured keys as json', () => {
    assert.equal(shouldPersistAsMarkdown('sources', [{ studyKey: 'study_a' }]), false);
    assert.equal(shouldPersistAsMarkdown('facts', { items: [] }), false);
    assert.equal(shouldPersistAsMarkdown('study_example', { url: 'https://x', title: 'x' }), false);
    assert.equal(shouldPersistAsMarkdown('identity', { preferredName: 'Zay' }), false);
    assert.equal(resolveKnowledgeFileExtension('meta', { slug: 'topic' }), '.json');
  });

  it('serializes markdown bodies', () => {
    assert.equal(serializeMarkdownBody('hello'), 'hello\n');
    assert.equal(serializeMarkdownBody({ content: '# Title' }), '# Title\n');
    assert.match(
      serializeMarkdownBody({ agent: 'agent body', mastermind: 'mastermind body' }),
      /## Mastermind[\s\S]*mastermind body[\s\S]*## Agent[\s\S]*agent body/,
    );
    assert.equal(serializeMarkdownBody({ mastermind: '# Profile' }), '# Profile\n');
  });

  it('preserves existing file extension when provided', () => {
    assert.equal(resolveKnowledgeFileExtension('key_facts_md', { content: 'x' }, '.json'), '.json');
    assert.equal(resolveKnowledgeFileExtension('meta', { slug: 'x' }, '.md'), '.md');
  });

  it('measures payload bytes by extension', () => {
    const markdownBytes = measurePersistPayloadBytes('key_facts_md', { content: 'abc' }, '.md');
    const jsonBytes = measurePersistPayloadBytes('meta', { slug: 'topic' }, '.json');

    assert.equal(markdownBytes, Buffer.byteLength('abc\n', 'utf8'));
    assert.ok(jsonBytes > markdownBytes);
  });
});
