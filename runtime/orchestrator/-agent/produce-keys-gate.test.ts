import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import { missingProduceKeys } from '@/orchestrator/-agent/produce-keys-retry';

describe('produceContextKeys gate', () => {
  it('returns missing keys when produceContextKeys not in storage', () => {
    const stage = {
      spec: { produceContextKeys: ['user_region', 'other'] },
    } as ParsedStage;

    const missing = missingProduceKeys(stage, { context: new Map(), types: new Map() });

    assert.deepEqual(missing, ['user_region', 'other']);
  });

  it('returns empty when all produceContextKeys are set', () => {
    const stage = {
      spec: { produceContextKeys: ['user_region'] },
    } as ParsedStage;

    const missing = missingProduceKeys(stage, {
      context: new Map([['user_region', { id: 'hko' }]]),
      types: new Map(),
    });

    assert.deepEqual(missing, []);
  });

  it('skips gate when stage has no produceContextKeys', () => {
    const stage = { spec: {} } as ParsedStage;

    const missing = missingProduceKeys(stage, { context: new Map(), types: new Map() });

    assert.deepEqual(missing, []);
  });
});
