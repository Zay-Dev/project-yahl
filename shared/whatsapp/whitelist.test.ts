import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  normalizeWhatsAppRecipient,
  parseWhatsAppWhitelist,
  recipientMatchesWhatsAppWhitelist,
  sanitizeWhatsAppFolder,
  toWhatsAppChatId,
} from './whitelist.ts';

describe('whatsapp whitelist', () => {
  it('parses comma-separated entries', () => {
    assert.deepEqual(parseWhatsAppWhitelist('91234567, +85298765432'), [
      '91234567',
      '+85298765432',
    ]);
  });

  it('matches local and E.164 forms', () => {
    const list = parseWhatsAppWhitelist('91234567');

    assert.equal(recipientMatchesWhatsAppWhitelist('91234567', list), true);
    assert.equal(recipientMatchesWhatsAppWhitelist('+85291234567', list), true);
    assert.equal(recipientMatchesWhatsAppWhitelist('85291234567@c.us', list), true);
    assert.equal(recipientMatchesWhatsAppWhitelist('99999999', list), false);
  });

  it('builds chat ids and folders', () => {
    assert.equal(toWhatsAppChatId('91234567'), '91234567@c.us');
    assert.equal(normalizeWhatsAppRecipient('+852-9123-4567'), '85291234567');
    assert.equal(sanitizeWhatsAppFolder('85291234567@c.us'), '85291234567-c-us');
  });
});
