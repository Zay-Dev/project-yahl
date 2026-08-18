import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SEARCH_AGENT_PHASE,
  buildFinalWriteUserMessage,
  selectSearchAgentTools,
} from './knowledge-search-agent.mjs';

describe('selectSearchAgentTools', () => {
  it('offers shell during explore and write-only on the final turn', () => {
    assert.deepEqual(
      selectSearchAgentTools(SEARCH_AGENT_PHASE.explore).map((tool) => tool.function.name),
      ['shell', 'write_workspace_file'],
    );
    assert.deepEqual(
      selectSearchAgentTools(SEARCH_AGENT_PHASE.finalWrite).map((tool) => tool.function.name),
      ['write_workspace_file'],
    );
  });
});

describe('buildFinalWriteUserMessage', () => {
  it('names the output file and forbids more search', () => {
    const message = buildFinalWriteUserMessage('lookup-result.json');

    assert.equal(message.role, 'user');
    assert.match(message.content, /lookup-result\.json/);
    assert.match(message.content, /write_workspace_file/);
    assert.match(message.content, /Do not search more/);
    assert.match(message.content, /Do not call shell/);
  });
});
