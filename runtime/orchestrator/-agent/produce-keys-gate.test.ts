import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

const _missingProduceKeys = (
  stage: ParsedStage,
  storage: { context: Map<string, unknown> },
) =>
  stage.spec.produceContextKeys?.filter(
    (key) => storage.context.get(key) == null,
  ) ?? [];

describe('produceContextKeys gate', () => {
  it('returns missing keys when produceContextKeys not in storage', () => {
    const stage = {
      spec: { produceContextKeys: ['user_region', 'other'] },
    } as ParsedStage;

    const missing = _missingProduceKeys(stage, { context: new Map() });

    assert.deepEqual(missing, ['user_region', 'other']);
  });

  it('returns empty when all produceContextKeys are set', () => {
    const stage = {
      spec: { produceContextKeys: ['user_region'] },
    } as ParsedStage;

    const missing = _missingProduceKeys(stage, {
      context: new Map([['user_region', { id: 'hko' }]]),
    });

    assert.deepEqual(missing, []);
  });

  it('skips gate when stage has no produceContextKeys', () => {
    const stage = { spec: {} } as ParsedStage;

    const missing = _missingProduceKeys(stage, { context: new Map() });

    assert.deepEqual(missing, []);
  });
});
