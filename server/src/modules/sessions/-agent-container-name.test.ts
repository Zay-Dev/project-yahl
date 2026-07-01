import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveAgentContainerName } from './-agent-container-name';

describe('resolveAgentContainerName', () => {
  it('uses agent-{sessionId} naming', () => {
    assert.equal(resolveAgentContainerName('sess-1'), 'agent-sess-1');
  });
});
