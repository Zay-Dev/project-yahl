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
});
