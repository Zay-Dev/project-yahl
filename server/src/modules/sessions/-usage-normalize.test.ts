import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import '@/core';

import {
  addTokenTotals,
  emptyTokenTotals,
  nixeryDefIdFromTags,
  normalizeUsageToTokenTotals,
  summarizeRequestIdUsagesFromDocs,
  summarizeSessionUsageFromDocs,
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

describe('nixeryDefIdFromTags', () => {
  it('reads the first nixery def id', () => {
    assert.equal(
      nixeryDefIdFromTags(['chat', 'nixery:resolve-error-with-knowledge']),
      'resolve-error-with-knowledge',
    );
  });

  it('returns null when tags have no nixery def', () => {
    assert.equal(nixeryDefIdFromTags(['chat', 'tool']), null);
    assert.equal(nixeryDefIdFromTags(['nixery:']), null);
    assert.equal(nixeryDefIdFromTags(undefined), null);
  });
});

describe('summarizeSessionUsageFromDocs', () => {
  const stageUsage = {
    completion_tokens: 10,
    prompt_tokens: 20,
    total_tokens: 30,
  };
  const nixeryUsage = {
    completion_tokens: 4,
    prompt_tokens: 6,
    total_tokens: 10,
  };

  it('keeps untagged calls in stages and splits nixery defs', () => {
    const summary = summarizeSessionUsageFromDocs([
      {
        createdAt: '2026-08-19T01:00:00.000Z',
        domain: 'api.openai.com',
        response: { usage: stageUsage },
        tags: ['chat'],
      },
      {
        createdAt: '2026-08-19T01:01:00.000Z',
        domain: 'api.deepseek.com',
        response: { usage: nixeryUsage },
        tags: ['chat', 'nixery:resolve-error-with-knowledge'],
      },
      {
        createdAt: '2026-08-19T01:02:00.000Z',
        domain: 'api.deepseek.com',
        response: { usage: nixeryUsage },
        tags: ['nixery:submit-knowledge-observation'],
      },
    ]);

    assert.equal(summary.tokenTotals?.totalTokens, 50);
    assert.equal(summary.stageTokenTotals?.totalTokens, 30);
    assert.deepEqual(
      summary.nixeryUsage.map((group) => [group.defId, group.tokenTotals?.totalTokens]),
      [
        ['resolve-error-with-knowledge', 10],
        ['submit-knowledge-observation', 10],
      ],
    );
    assert.equal(summary.lastModelResponseAt, '2026-08-19T01:02:00.000Z');
    assert.deepEqual(summary.domains, ['api.deepseek.com', 'api.openai.com']);
  });

  it('treats missing tags as stage usage', () => {
    const summary = summarizeSessionUsageFromDocs([
      {
        createdAt: '2026-08-19T03:00:00.000Z',
        response: { usage: stageUsage },
      },
    ]);

    assert.equal(summary.stageTokenTotals?.totalTokens, 30);
    assert.deepEqual(summary.nixeryUsage, []);
    assert.equal(summary.lastModelResponseAt, '2026-08-19T03:00:00.000Z');
  });
});

describe('summarizeRequestIdUsagesFromDocs', () => {
  it('sums duration and keeps the latest call duration', () => {
    const byRequestId = summarizeRequestIdUsagesFromDocs(
      [
        {
          createdAt: '2026-08-19T02:00:00.000Z',
          durationMs: 1000,
          requestId: 'r1',
          response: { usage: { completion_tokens: 1, prompt_tokens: 2, total_tokens: 3 } },
        },
        {
          createdAt: '2026-08-19T02:01:00.000Z',
          durationMs: 2500,
          requestId: 'r1',
          response: { usage: { completion_tokens: 4, prompt_tokens: 5, total_tokens: 9 } },
        },
      ],
      ['r1', 'r2'],
    );
    const r1 = byRequestId.get('r1');
    const r2 = byRequestId.get('r2');

    assert.equal(r1?.modelDurationMs, 3500);
    assert.equal(r1?.lastModelDurationMs, 2500);
    assert.equal(r1?.lastModelResponseAt, '2026-08-19T02:01:00.000Z');
    assert.equal(r1?.tokenTotals?.totalTokens, 12);
    assert.equal(r2?.modelDurationMs, 0);
    assert.equal(r2?.tokenTotals, null);
  });
});
