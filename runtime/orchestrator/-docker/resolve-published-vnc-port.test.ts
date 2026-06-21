import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseDockerPortOutput } from '@/orchestrator/-docker/resolve-published-vnc-port';

describe('parseDockerPortOutput', () => {
  it('parses IPv4 docker port line', () => {
    assert.equal(parseDockerPortOutput('0.0.0.0:5901\n'), 5901);
  });

  it('parses IPv6 docker port line', () => {
    assert.equal(parseDockerPortOutput('[::]:5902'), 5902);
  });

  it('returns undefined for empty output', () => {
    assert.equal(parseDockerPortOutput(''), undefined);
    assert.equal(parseDockerPortOutput('   \n'), undefined);
  });
});
