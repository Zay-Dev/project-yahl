import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildSystemPrompt,
  parseVerifyContent,
} from './run.mjs';

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
  });
});
