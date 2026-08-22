import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveLlmMessageText } from './llm-completion.mjs';

describe('resolveLlmMessageText', () => {
  it('prefers message content', () => {
    assert.equal(
      resolveLlmMessageText({
        choice: { content: ' {"action":"skip"} ' },
        finishReason: 'stop',
      }),
      '{"action":"skip"}',
    );
  });

  it('falls back to JSON blob in reasoning_content', () => {
    assert.equal(
      resolveLlmMessageText({
        choice: {
          content: '',
          reasoning_content: 'thinking...\n{"action":"advise","scriptId":"fetch-driving-routes"}\n',
        },
        finishReason: 'stop',
      }),
      '{"action":"advise","scriptId":"fetch-driving-routes"}',
    );
  });

  it('throws when finish_reason is length and content empty', () => {
    assert.throws(
      () => resolveLlmMessageText({
        choice: { content: '', reasoning_content: 'still deciding…' },
        finishReason: 'length',
      }),
      /finish_reason=length/,
    );
  });

  it('returns content even when finish_reason is length', () => {
    assert.equal(
      resolveLlmMessageText({
        choice: { content: '{"action":"skip","reasons":["ok"],"notesHint":"none"}' },
        finishReason: 'length',
      }),
      '{"action":"skip","reasons":["ok"],"notesHint":"none"}',
    );
  });

  it('returns empty when stop and no content or JSON', () => {
    assert.equal(
      resolveLlmMessageText({
        choice: { content: null, reasoning_content: 'no json here' },
        finishReason: 'stop',
      }),
      '',
    );
  });
});
