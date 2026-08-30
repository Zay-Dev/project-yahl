import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildWarmupPrefixMessages } from './warmup-prefix';

describe('buildWarmupPrefixMessages', () => {
  it('walks assistant completions and stubs tool results', () => {
    const messages = buildWarmupPrefixMessages({
      modelResponses: [{
        response: {
          choices: [{
            message: {
              content: 'opening',
              role: 'assistant',
              tool_calls: [{
                function: { arguments: '{}', name: 'run_bash' },
                id: 'call-1',
                type: 'function',
              }],
            },
          }],
        },
      }],
    });

    assert.equal(messages[0]?.role, 'assistant');
    assert.equal(messages[1]?.role, 'tool');
    assert.equal(messages[1] && 'tool_call_id' in messages[1] ? messages[1].tool_call_id : '', 'call-1');
    assert.equal(messages[1] && 'content' in messages[1] ? messages[1].content : '', JSON.stringify({ ok: true }));
  });

  it('ignores persisted OK stubs and falls back to default stub', () => {
    const messages = buildWarmupPrefixMessages({
      modelResponses: [{
        response: {
          choices: [{
            message: {
              content: 'read skill',
              role: 'assistant',
              tool_calls: [{
                function: { arguments: '{"command":"cat SKILL.md"}', name: 'run_bash' },
                id: 'call-1',
                type: 'function',
              }],
            },
          }],
        },
      }],
      toolCalls: [{
        tools: [{
          arguments: { command: 'cat SKILL.md' },
          id: 'call-1',
          name: 'run_bash',
          result: 'OK',
        }],
      }],
    });

    assert.equal(messages[1] && 'content' in messages[1] ? messages[1].content : '', JSON.stringify({ ok: true }));
  });

  it('uses persisted tool results when present', () => {
    const messages = buildWarmupPrefixMessages({
      modelResponses: [{
        response: {
          choices: [{
            message: {
              content: 'read skill',
              role: 'assistant',
              tool_calls: [{
                function: { arguments: '{"command":"cat SKILL.md"}', name: 'run_bash' },
                id: 'call-1',
                type: 'function',
              }],
            },
          }],
        },
      }],
      toolCalls: [{
        tools: [{
          arguments: { command: 'cat SKILL.md' },
          id: 'call-1',
          name: 'run_bash',
          result: '# route-analysis\n\nJudgment.',
        }],
      }],
    });

    assert.equal(messages[1] && 'content' in messages[1] ? messages[1].content : '', '# route-analysis\n\nJudgment.');
  });
});
