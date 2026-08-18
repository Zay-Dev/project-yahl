import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { remapOneCliProxyHost } from './onecli-snapshot';

describe('remapOneCliProxyHost', () => {
  it('remaps legacy host.docker.internal proxy to onecli service', () => {
    assert.equal(
      remapOneCliProxyHost('http://x:secret@host.docker.internal:10255'),
      'http://x:secret@onecli:10255',
    );
  });
});
