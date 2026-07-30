import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  normalizeEmailRecipient,
  parseEmailWhitelist,
  recipientMatchesEmailWhitelist,
} from './whitelist.ts';

describe('email whitelist', () => {
  it('parses comma-separated entries', () => {
    assert.deepEqual(parseEmailWhitelist('a@example.com, B@Example.COM'), [
      'a@example.com',
      'B@Example.COM',
    ]);
  });

  it('matches case-insensitively', () => {
    const list = parseEmailWhitelist('Admin@Example.com');

    assert.equal(recipientMatchesEmailWhitelist('admin@example.com', list), true);
    assert.equal(recipientMatchesEmailWhitelist('ADMIN@EXAMPLE.COM', list), true);
    assert.equal(recipientMatchesEmailWhitelist('other@example.com', list), false);
  });

  it('normalizes recipients', () => {
    assert.equal(normalizeEmailRecipient('  Foo@Bar.COM '), 'foo@bar.com');
  });

  it('rejects empty whitelist or recipient', () => {
    assert.equal(recipientMatchesEmailWhitelist('a@b.com', []), false);
    assert.equal(recipientMatchesEmailWhitelist('', parseEmailWhitelist('a@b.com')), false);
  });
});
