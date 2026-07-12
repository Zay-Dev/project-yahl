import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isValidNixeryEnvelope } from '@/orchestrator/-nixery/validate-output';
import { resolveNixeryContainerName } from '@/orchestrator/-nixery/run-container';

describe('resolveNixeryContainerName', () => {
  it('builds stable docker-safe name from session and def', () => {
    const name = resolveNixeryContainerName('85053f4a-9f9c-48a0-bd97-398ed61380b3', 'list-knowledge-pages');

    assert.equal(name.length, 63);
    assert.match(name, /^nixery-85053f4a-9f9c-48a0-bd97-398ed61380b3-list-knowledge/);
  });
});

describe('isValidNixeryEnvelope', () => {
  it('accepts present extract', () => {
    assert.equal(isValidNixeryEnvelope({
      absent: false,
      extracted: [{ page: 'overview' }],
    }), true);
  });

  it('accepts absent with absentReason', () => {
    assert.equal(isValidNixeryEnvelope({
      absent: true,
      absentReason: 'ls en/topics/foo → empty',
      extracted: null,
    }), true);
  });

  it('rejects partial absent without reason', () => {
    assert.equal(isValidNixeryEnvelope({ absent: true }), false);
  });

  it('accepts custom get-knowledge intake payload without extracted', () => {
    assert.equal(isValidNixeryEnvelope({
      absent: false,
      extractedAt: '2026-07-13T00:00:00.000Z',
      topic: 'project-yahl-develop',
      corpusSnapshot: { pageCount: 30 },
    }), true);
  });

  it('rejects truncated partial json shape', () => {
    assert.equal(isValidNixeryEnvelope({ absent: false, extracted: '[' }), false);
  });
});
