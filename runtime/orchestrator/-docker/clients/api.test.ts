import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveOneCliDashboardUrl } from '@/orchestrator/-docker/clients/api';

describe('resolveOneCliDashboardUrl', () => {
  it('rewrites docker service hostname to localhost', () => {
    assert.equal(
      resolveOneCliDashboardUrl('http://onecli:10254'),
      'http://127.0.0.1:10254',
    );
  });

  it('preserves other hostnames', () => {
    assert.equal(
      resolveOneCliDashboardUrl('http://127.0.0.1:10254/'),
      'http://127.0.0.1:10254',
    );
  });
});
