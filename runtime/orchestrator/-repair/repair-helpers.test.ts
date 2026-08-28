import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import {
  REPAIR_MIN_MAX_BASH_CALLS,
  REPAIR_MIN_MAX_TURNS,
  applyRepairBudgets,
  buildRepairSystemAppend,
} from '@/orchestrator/-repair/repair-helpers';

describe('buildRepairSystemAppend', () => {
  it('includes the user instruction and repair-first framing', () => {
    const append = buildRepairSystemAppend('Fix the summary to mention peak hour traffic.');

    assert.match(append, /targeted repair/i);
    assert.match(append, /primary goal/i);
    assert.match(append, /durable writes/i);
    assert.match(append, /set_context/i);
    assert.match(append, /Fix the summary to mention peak hour traffic\./);
    assert.doesNotMatch(append, /keeping every other stage requirement unchanged/i);
  });

  it('trims surrounding whitespace from the instruction', () => {
    const append = buildRepairSystemAppend('  use the latest counts  ');

    assert.match(append, /use the latest counts$/);
  });
});

describe('applyRepairBudgets', () => {
  const baseStage = (spec: ParsedStage['spec']): ParsedStage => ({
    lines: 'logic: body',
    sourceStartLine: 1,
    spec,
    type: 'plain',
  });

  it('raises submit_wait-sized caps to repair floors', () => {
    const stage = applyRepairBudgets(baseStage({
      logic: 'submit',
      maxBashCalls: 12,
      maxTurns: 14,
    }));

    assert.equal(stage.spec.maxTurns, REPAIR_MIN_MAX_TURNS);
    assert.equal(stage.spec.maxBashCalls, REPAIR_MIN_MAX_BASH_CALLS);
  });

  it('keeps larger stage caps unchanged', () => {
    const stage = applyRepairBudgets(baseStage({
      logic: 'body',
      maxBashCalls: 80,
      maxTurns: 100,
    }));

    assert.equal(stage.spec.maxTurns, 100);
    assert.equal(stage.spec.maxBashCalls, 80);
  });

  it('fills missing caps with repair floors', () => {
    const stage = applyRepairBudgets(baseStage({ logic: 'body' }));

    assert.equal(stage.spec.maxTurns, REPAIR_MIN_MAX_TURNS);
    assert.equal(stage.spec.maxBashCalls, REPAIR_MIN_MAX_BASH_CALLS);
  });
});
