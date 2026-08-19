import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { patchRunInputFromStorageSeed } from './fork-session-write';

describe('patchRunInputFromStorageSeed', () => {
  it('overrides runInput keys from storageSeed.context', () => {
    const patched = patchRunInputFromStorageSeed({
      runInputContextKeys: ['monitor_minutes'],
      sourceRunInput: {
        monitor_minutes: '10',
        notify_to: '85291234567',
      },
      storageSeed: {
        context: {
          monitor_minutes: '11',
        },
        types: {},
      },
    });

    assert.equal(patched.monitor_minutes, '11');
    assert.equal(patched.notify_to, '85291234567');
  });

  it('keeps source runInput when storageSeed.context omits the key', () => {
    const patched = patchRunInputFromStorageSeed({
      runInputContextKeys: ['monitor_minutes'],
      sourceRunInput: {
        monitor_minutes: '10',
      },
      storageSeed: {
        context: {},
        types: {},
      },
    });

    assert.equal(patched.monitor_minutes, '10');
  });
});

