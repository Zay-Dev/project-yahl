import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  copyVncAddress,
  formatVncAddress,
  formatVncDeeplink,
} from '@/pages/sessions/lib/vnc-clients';

describe('vnc-clients', () => {
  it('builds localhost address and deeplink', () => {
    assert.equal(formatVncAddress(5901), 'localhost:5901');
    assert.equal(formatVncDeeplink(5901), 'vnc://localhost:5901');
  });

  it('copies localhost address via clipboard API', async () => {
    const writes: string[] = [];
    const original = globalThis.navigator;

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        clipboard: {
          writeText: async (value: string) => {
            writes.push(value);
          },
        },
      },
    });

    try {
      await copyVncAddress(5902);
      assert.deepEqual(writes, ['localhost:5902']);
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: original,
      });
    }
  });
});
