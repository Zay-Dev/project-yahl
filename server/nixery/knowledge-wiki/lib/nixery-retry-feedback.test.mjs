import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  appendNixeryRetryUserMessage,
  buildNixeryRetryUserMessage,
  readNixeryRetryFeedback,
  readNixeryRetryMeta,
} from './nixery-retry-feedback.mjs';

describe('nixery-retry-feedback', () => {
  it('reads feedback from input.nixeryRetry', () => {
    assert.equal(
      readNixeryRetryFeedback({
        nixeryRetry: { feedback: ' output file missing ' },
      }),
      'output file missing',
    );
  });

  it('returns null without feedback', () => {
    assert.equal(readNixeryRetryFeedback({}), null);
    assert.equal(readNixeryRetryFeedback({ nixeryRetry: { attempt: 1 } }), null);
  });

  it('reads retry meta with defaults', () => {
    assert.deepEqual(readNixeryRetryMeta({}), {
      attempt: 0,
      isFinalAttempt: true,
      maxAttempts: 1,
    });

    assert.deepEqual(readNixeryRetryMeta({
      nixeryRetry: {
        attempt: 2,
        isFinalAttempt: false,
        maxAttempts: 10,
      },
    }), {
      attempt: 2,
      isFinalAttempt: false,
      maxAttempts: 10,
    });
  });

  it('appends a user message when feedback is present', () => {
    const messages = [{ role: 'system', content: 'sys' }];

    appendNixeryRetryUserMessage(messages, 'bad output');

    assert.equal(messages.length, 2);
    assert.deepEqual(messages[1], buildNixeryRetryUserMessage('bad output'));
  });

  it('does not append when feedback is empty', () => {
    const messages = [{ role: 'user', content: 'hi' }];

    appendNixeryRetryUserMessage(messages, '');
    appendNixeryRetryUserMessage(messages, null);

    assert.equal(messages.length, 1);
  });
});
