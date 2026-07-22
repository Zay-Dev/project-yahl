import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  dedupePackages,
  resolveCustomNixeryImageTag,
  resolveNixeryImage,
  resolveNixeryRegistry,
} from '@/orchestrator/-nixery/run-container';

describe('dedupePackages', () => {
  it('removes duplicates while preserving order', () => {
    assert.deepEqual(dedupePackages(['git', 'jq', 'git', 'curl']), ['git', 'jq', 'curl']);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(dedupePackages([]), []);
  });
});

describe('resolveNixeryImage', () => {
  it('builds composed registry ref from packages', () => {
    assert.equal(
      resolveNixeryImage('nixery.dev', ['git', 'jq']),
      'nixery.dev/git/jq',
    );
  });

  it('dedupes packages before composing ref', () => {
    assert.equal(
      resolveNixeryImage('nixery.dev', ['git', 'jq', 'git']),
      'nixery.dev/git/jq',
    );
  });

  it('handles single package', () => {
    assert.equal(resolveNixeryImage('nixery.dev', ['git']), 'nixery.dev/git');
  });
});

describe('resolveCustomNixeryImageTag', () => {
  it('tags with md5 of Dockerfile bytes', () => {
    const body = 'ARG NIXERY_BASE\nFROM ${NIXERY_BASE}\n';
    const hash = createHash('md5').update(body).digest('hex');

    assert.equal(
      resolveCustomNixeryImageTag('media-to-text', body),
      `custom-nixery-media-to-text:v${hash}`,
    );
  });
});

describe('resolveNixeryRegistry', () => {
  it('defaults to nixery.dev', () => {
    const original = process.env.NIXERY_REGISTRY;

    delete process.env.NIXERY_REGISTRY;

    try {
      assert.equal(resolveNixeryRegistry(), 'nixery.dev');
    } finally {
      if (original === undefined) {
        delete process.env.NIXERY_REGISTRY;
      } else {
        process.env.NIXERY_REGISTRY = original;
      }
    }
  });
});
