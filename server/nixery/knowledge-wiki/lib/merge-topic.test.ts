import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pickCanonicalTopic } from './merge-topic.js';
import {
  groupManagerTopics,
  omitAliasManagerTopics,
} from './run-knowledge-manager.js';

describe('pickCanonicalTopic', () => {
  it('prefers the shortest non-plural stem', () => {
    assert.equal(
      pickCanonicalTopic([
        'platform-notifications',
        'platform',
        'platform-notification',
        'notifications',
      ]),
      'platform',
    );
  });

  it('tie-breaks lexicographically at equal stem length', () => {
    assert.equal(
      pickCanonicalTopic(['traffic-monitor-b', 'traffic-monitor-a']),
      'traffic-monitor-a',
    );
  });
});

describe('omitAliasManagerTopics', () => {
  it('drops registry alias slugs while keeping canonicals', () => {
    assert.deepEqual(
      omitAliasManagerTopics(
        [
          'notifications',
          'platform',
          'platform-notification',
          'traffic-monitor',
        ],
        ['notifications', 'platform-notification'],
      ),
      ['platform', 'traffic-monitor'],
    );
  });
});

describe('groupManagerTopics canonical', () => {
  it('sets canonical on multi-topic prefix groups', () => {
    const groups = groupManagerTopics([
      'platform',
      'platform-notification',
      'platform-notifications',
    ]);
    const platform = groups.find((group) => group.id === 'prefix-platform');

    assert.ok(platform);
    assert.equal(platform?.canonical, 'platform');
  });
});
