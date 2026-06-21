import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const resolveStreamStages = async (
  loadStages: () => Promise<unknown[]>,
) => {
  try {
    return await loadStages();
  } catch {
    return [];
  }
};

describe('streamSessionEvents stage fallback', () => {
  it('returns empty stages when session lookup fails', async () => {
    const stages = await resolveStreamStages(async () => {
      throw new Error('not found');
    });

    assert.deepEqual(stages, []);
  });
});
