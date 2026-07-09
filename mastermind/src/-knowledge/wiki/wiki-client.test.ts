import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildWikiAncestorPaths } from './wiki-client.js';

describe('buildWikiAncestorPaths', () => {
  it('returns ordered ancestor prefixes for nested paths', () => {
    assert.deepEqual(
      buildWikiAncestorPaths('topics/user-onboarding/identity'),
      ['topics', 'topics/user-onboarding'],
    );
  });

  it('returns no ancestors for single-segment paths', () => {
    assert.deepEqual(buildWikiAncestorPaths('home'), []);
    assert.deepEqual(buildWikiAncestorPaths('topics'), []);
  });

  it('strips leading and trailing slashes', () => {
    assert.deepEqual(
      buildWikiAncestorPaths('/topics/_wiki-smoke/overview/'),
      ['topics', 'topics/_wiki-smoke'],
    );
  });
});
