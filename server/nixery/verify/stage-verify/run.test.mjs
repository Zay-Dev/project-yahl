import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildSystemPrompt,
  parseVerifyContent,
} from './run.mjs';
import {
  INLINE_VALUE_CHARS,
  buildKeyCatalog,
  buildVerifyUserMessage,
  clipText,
  pickInlineProduceValues,
} from '../lib/snapshot-catalog.mjs';

describe('parseVerifyContent', () => {
  it('parses compact verify JSON', () => {
    const parsed = parseVerifyContent({
      classifyResume: false,
      minScore: 0.75,
      text: '{"score":1,"pass":true,"feedback":"all good"}',
    });

    assert.deepEqual(parsed, {
      feedback: 'all good',
      pass: true,
      score: 1,
    });
  });

  it('throws on empty content', () => {
    assert.throws(
      () => parseVerifyContent({ classifyResume: false, minScore: 0.75, text: '  ' }),
      /empty LLM content/,
    );
  });

  it('throws on truncated JSON', () => {
    assert.throws(
      () => parseVerifyContent({
        classifyResume: false,
        minScore: 0.75,
        text: '{"score":0,"pass":false,"feedback":"unterminated',
      }),
      /JSON|Unexpected|Unterminated/,
    );
  });

  it('caps long feedback at 200 chars', () => {
    const long = 'x'.repeat(250);
    const parsed = parseVerifyContent({
      classifyResume: false,
      minScore: 0.75,
      text: JSON.stringify({ feedback: long, pass: true, score: 1 }),
    });

    assert.equal(parsed.feedback.length, 200);
    assert.ok(parsed.feedback.endsWith('...'));
  });
});

describe('buildSystemPrompt', () => {
  it('asks for compact JSON and short feedback', () => {
    const prompt = buildSystemPrompt({ classifyResume: false, minScore: 0.75 });

    assert.match(prompt, /compact JSON/i);
    assert.match(prompt, /feedback <= 200/);
    assert.match(prompt, /No markdown fences/);
    assert.match(prompt, /read_context_key/);
    assert.match(prompt, /write_workspace_file path=result.json/);
  });
});

describe('snapshot catalog', () => {
  it('lists keys with compact json byte sizes', () => {
    const catalog = buildKeyCatalog({
      zed: 'ab',
      alpha: { n: 1 },
    });

    assert.deepEqual(catalog, [
      { bytes: Buffer.byteLength('{"n":1}', 'utf8'), key: 'alpha' },
      { bytes: Buffer.byteLength('"ab"', 'utf8'), key: 'zed' },
    ]);
  });

  it('clips with a truncated suffix', () => {
    assert.deepEqual(clipText('abcdef', 3), {
      text: 'abc\n...[truncated]',
      truncated: true,
    });
    assert.deepEqual(clipText('ab', 8), { text: 'ab', truncated: false });
  });

  it('inlines small produceContextKeys and omits large ones', () => {
    const large = 'x'.repeat(INLINE_VALUE_CHARS + 1);
    const { inline, omitted } = pickInlineProduceValues(
      {
        topic: 'alpha',
        howto_md: large,
        skipped: 'not produced',
      },
      ['topic', 'howto_md', 'missing'],
    );

    assert.deepEqual(inline, { topic: 'alpha' });
    assert.deepEqual(omitted, ['howto_md']);
  });

  it('puts catalog and small produce values in the user message, not the full snapshot', () => {
    const large = 'y'.repeat(INLINE_VALUE_CHARS + 1);
    const message = buildVerifyUserMessage({
      context: {
        topic: 'alpha',
        howto_md: large,
        reviews_acc: [{ topic: 'alpha' }],
      },
      rubricText: 'Pass when topic is non-empty.',
      stageSnapshot: { produceContextKeys: ['topic', 'howto_md'] },
      types: {},
    });

    assert.match(message, /## Rubric/);
    assert.match(message, /"key":"topic"/);
    assert.match(message, /"key":"howto_md"/);
    assert.match(message, /Produce context \(inline\)/);
    assert.match(message, /"topic":"alpha"/);
    assert.match(message, /Produce context omitted/);
    assert.doesNotMatch(message, /yyyyyyyyyy/);
    assert.doesNotMatch(message, /reviews_acc":\[/);
  });
});

describe('parseVerifyContent from write_workspace_file JSON', () => {
  it('parses a tool-written gate file body', () => {
    const written = `${JSON.stringify({
      failedChecks: [{ id: 'topic', reason: 'empty' }],
      feedback: 'topic missing',
      pass: false,
      score: 0.2,
    }, null, 2)}\n`;

    const parsed = parseVerifyContent({
      classifyResume: false,
      minScore: 0.75,
      text: written,
    });

    assert.deepEqual(parsed, {
      failedChecks: [{ id: 'topic', reason: 'empty' }],
      feedback: 'topic missing',
      pass: false,
      score: 0.2,
    });
  });
});
