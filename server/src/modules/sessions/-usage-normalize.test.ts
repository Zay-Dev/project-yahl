import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import '@/core';

import {
  addTokenTotals,
  emptyTokenTotals,
  normalizeUsageToTokenTotals,
  uniqueSortedDomains,
} from './-usage-normalize';

describe('token totals from model-response usage', () => {
  it('sums multiple normalized usages into one stage total', () => {
    const first = normalizeUsageToTokenTotals({
      completion_tokens: 2111,
      prompt_tokens: 6589,
      total_tokens: 8700,
    });
    const second = normalizeUsageToTokenTotals({
      completion_tokens: 86,
      prompt_tokens: 6726,
      total_tokens: 6812,
    });
    const third = normalizeUsageToTokenTotals({
      completion_tokens: 3,
      prompt_tokens: 6829,
      total_tokens: 6832,
    });

    const totals = emptyTokenTotals();

    addTokenTotals(totals, first!);
    addTokenTotals(totals, second!);
    addTokenTotals(totals, third!);

    assert.equal(totals.completionTokens, 2200);
    assert.equal(totals.promptTokens, 20144);
    assert.equal(totals.totalTokens, 22344);
  });

  it('returns null when no usage fields are present', () => {
    assert.equal(normalizeUsageToTokenTotals(undefined), null);
    assert.equal(normalizeUsageToTokenTotals({}), null);
  });

  it('collects unique sorted domains and drops blanks', () => {
    assert.deepEqual(
      uniqueSortedDomains(['api.openai.com', ' api.deepseek.com ', '', 'api.deepseek.com', '  ']),
      ['api.deepseek.com', 'api.openai.com'],
    );
  });
});
