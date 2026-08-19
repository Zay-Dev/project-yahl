import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveLlmMessageText } from './llm-completion.mjs';

describe('resolveLlmMessageText', () => {
  it('prefers message content', () => {
    assert.equal(
      resolveLlmMessageText({
        choice: { content: ' {"pass":true} ' },
        finishReason: 'stop',
      }),
      '{"pass":true}',
    );
  });

  it('falls back to JSON blob in reasoning_content', () => {
    assert.equal(
      resolveLlmMessageText({
        choice: {
          content: '',
          reasoning_content: 'thinking...\n{"score":1,"pass":true,"feedback":"ok"}\n',
        },
        finishReason: 'stop',
      }),
      '{"score":1,"pass":true,"feedback":"ok"}',
    );
  });

  it('throws when finish_reason is length', () => {
    assert.throws(
      () => resolveLlmMessageText({
        choice: { content: '{"pass":true' },
        finishReason: 'length',
      }),
      /finish_reason=length/,
    );
  });

  it('returns reasoning text when content empty and no JSON blob', () => {
    assert.equal(
      resolveLlmMessageText({
        choice: { content: null, reasoning_content: 'no json here' },
        finishReason: 'stop',
      }),
      'no json here',
    );
  });
});
