import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveOneCliDashboardUrl } from '@/orchestrator/-docker/clients/api';

describe('resolveOneCliDashboardUrl', () => {
  it('keeps the docker service hostname', () => {
    assert.equal(
      resolveOneCliDashboardUrl('http://onecli:10254'),
      'http://onecli:10254',
    );
  });

  it('preserves other hostnames', () => {
    assert.equal(
      resolveOneCliDashboardUrl('http://127.0.0.1:10254/'),
      'http://127.0.0.1:10254',
    );
  });
});
