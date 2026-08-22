import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildRepairSystemAppend } from '@/orchestrator/-repair/repair-helpers';

describe('buildRepairSystemAppend', () => {
  it('includes the user instruction and repair framing', () => {
    const append = buildRepairSystemAppend('Fix the summary to mention peak hour traffic.');

    assert.match(append, /targeted repair/i);
    assert.match(append, /set_context/i);
    assert.match(append, /Fix the summary to mention peak hour traffic\./);
  });

  it('trims surrounding whitespace from the instruction', () => {
    const append = buildRepairSystemAppend('  use the latest counts  ');

    assert.match(append, /use the latest counts$/);
  });
});
