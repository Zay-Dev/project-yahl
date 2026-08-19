import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  purposeIncludesRaw,
  resolveTopicScopeValues,
} from './resolve-topic-scope.mjs';

describe('purposeIncludesRaw', () => {
  it('defaults false', () => {
    assert.equal(purposeIncludesRaw('Read source-ops for hk'), false);
    assert.equal(purposeIncludesRaw('Seed from processed pages'), false);
  });

  it('opts in on explicit markers', () => {
    assert.equal(purposeIncludesRaw('includeRaw: true'), true);
    assert.equal(purposeIncludesRaw('search raw observations for the claim'), true);
  });
});

describe('resolveTopicScopeValues', () => {
  it('returns empty scope without topic', async () => {
    assert.deepEqual(await resolveTopicScopeValues(''), {
      aliasTopics: '',
      canonicalTopic: '',
      includeRaw: 'false',
      topic: '',
    });
  });

  it('falls back to requested slug when registry unavailable', async () => {
    const prev = process.env.TOPICS_REGISTRY_PATH;
    process.env.TOPICS_REGISTRY_PATH = '/tmp/missing-topics-registry.json';

    try {
      const scope = await resolveTopicScopeValues('traffic-monitor', 'processed only');

      assert.equal(scope.topic, 'traffic-monitor');
      assert.equal(scope.canonicalTopic, 'traffic-monitor');
      assert.equal(scope.aliasTopics, '(none)');
      assert.equal(scope.includeRaw, 'false');
    } finally {
      if (prev === undefined) {
        delete process.env.TOPICS_REGISTRY_PATH;
      } else {
        process.env.TOPICS_REGISTRY_PATH = prev;
      }
    }
  });
});
