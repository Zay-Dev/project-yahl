import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatVerifyCliSpawnError } from './verify-infra.js';

describe('formatVerifyCliSpawnError', () => {
  it('maps spawn ENOENT to agent CLI not found', () => {
    const error = formatVerifyCliSpawnError(
      Object.assign(new Error('spawn agent ENOENT'), { code: 'ENOENT' }),
    );

    assert.equal(error.message, 'agent CLI not found on PATH');
  });
});
