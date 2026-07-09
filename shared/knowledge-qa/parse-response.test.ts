import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseKnowledgeQaReviewResponse } from './parse-response.js';

describe('parseKnowledgeQaReviewResponse', () => {
  it('parses fenced json payload', () => {
    const parsed = parseKnowledgeQaReviewResponse(JSON.stringify({
      checks: [{ id: 'layout_canonical', pass: true }],
      todos: [],
      topic: 'demo-topic',
    }));

    assert.equal(parsed.topic, 'demo-topic');
    assert.equal(parsed.checks[0]?.pass, true);
  });
});
