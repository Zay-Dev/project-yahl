import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { anthropicResponseToOpenAi, openAiBodyToAnthropic } from './anthropic-translate.js';
import {
  isValidLlmProxyToken,
  normalizeDomain,
  resolveDomainFromRequest,
  resolveRetryMaxFromHeader,
} from './request-meta.js';

describe('normalizeDomain', () => {
  it('strips scheme and path', () => {
    assert.equal(normalizeDomain('https://api.deepseek.com/v1'), 'api.deepseek.com');
    assert.equal(normalizeDomain('http://www.openai.com'), 'www.openai.com');
    assert.equal(normalizeDomain('openai.com'), 'openai.com');
  });

  it('keeps www and apex distinct', () => {
    assert.notEqual(normalizeDomain('www.openai.com'), normalizeDomain('openai.com'));
  });
});

describe('resolveDomainFromRequest', () => {
  it('prefers header over query', () => {
    const headers = new Headers({ 'x-domain': 'api.deepseek.com' });
    const params = new URLSearchParams({ domain: 'other.example' });

    assert.equal(resolveDomainFromRequest(headers, params), 'api.deepseek.com');
  });

  it('reads query when header missing', () => {
    const headers = new Headers();
    const params = new URLSearchParams({ domain: 'https://api.openai.com/v1' });

    assert.equal(resolveDomainFromRequest(headers, params), 'api.openai.com');
  });
});

describe('resolveRetryMaxFromHeader', () => {
  it('uses default when omitted', () => {
    assert.equal(resolveRetryMaxFromHeader(new Headers(), 3), 3);
  });

  it('maps 0 to single attempt', () => {
    assert.equal(resolveRetryMaxFromHeader(new Headers({ 'x-llm-retry-max': '0' }), 3), 1);
  });

  it('accepts positive override', () => {
    assert.equal(resolveRetryMaxFromHeader(new Headers({ 'x-llm-retry-max': '5' }), 3), 5);
  });
});

describe('isValidLlmProxyToken', () => {
  it('rejects empty expected or missing header', () => {
    assert.equal(isValidLlmProxyToken(new Headers(), 'secret'), false);
    assert.equal(isValidLlmProxyToken(new Headers({ 'x-llm-proxy-token': 'secret' }), ''), false);
  });

  it('accepts matching header', () => {
    assert.equal(
      isValidLlmProxyToken(new Headers({ 'x-llm-proxy-token': 'secret' }), 'secret'),
      true,
    );
  });
});

describe('anthropic translate', () => {
  it('round-trips tool calls shape', () => {
    const anthropicBody = openAiBodyToAnthropic({
      messages: [
        { content: 'hi', role: 'user' },
      ],
      model: 'claude-3',
      tools: [{
        function: {
          description: 'run',
          name: 'run_bash',
          parameters: { type: 'object', properties: {} },
        },
        type: 'function',
      }],
    });

    assert.equal(anthropicBody.model, 'claude-3');
    assert.equal((anthropicBody.tools as unknown[]).length, 1);

    const openAi = anthropicResponseToOpenAi({
      content: [
        { text: 'ok', type: 'text' },
        { id: 'toolu_1', input: { cmd: 'ls' }, name: 'run_bash', type: 'tool_use' },
      ],
      id: 'msg_1',
      model: 'claude-3',
      stop_reason: 'tool_use',
      usage: { input_tokens: 10, output_tokens: 4 },
    });

    const message = (openAi.choices as Array<{ message: { tool_calls?: unknown[] } }>)[0]!.message;

    assert.equal(message.tool_calls?.length, 1);
  });
});
