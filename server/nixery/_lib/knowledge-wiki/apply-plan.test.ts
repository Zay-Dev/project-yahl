import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildHeuristicApplyPlan,
  resolveManagerDepth,
} from './run-knowledge-manager.js';
import { validateApplyPlan } from './apply-plan.js';

describe('validateApplyPlan', () => {
  it('accepts merge and transfer ops', () => {
    const validated = validateApplyPlan({
      topic: 'traffic-monitor',
      ops: [
        {
          op: 'merge',
          page: 'facts',
          section: 'HOWTO',
          mode: 'append',
          content: 'steps',
        },
        {
          op: 'transfer',
          targetTopic: 'hk-weather',
          claim: 'rain slows traffic',
          rationale: 'weather affects corridor ETAs',
        },
      ],
    });

    assert.equal(validated.ok, true);

    if (validated.ok) {
      assert.equal(validated.plan.ops.length, 2);
    }
  });

  it('rejects same-topic transfer', () => {
    const validated = validateApplyPlan({
      topic: 'a',
      ops: [{ op: 'transfer', targetTopic: 'a', claim: 'x', rationale: 'y' }],
    });

    assert.equal(validated.ok, false);
  });
});

describe('resolveManagerDepth', () => {
  it('marks Focus topics as focus', () => {
    const instruction = 'Focus:\n- traffic-monitor PLACE quality\n';

    assert.equal(resolveManagerDepth('traffic-monitor', instruction), 'focus');
    assert.equal(resolveManagerDepth('other-topic', instruction), 'light');
  });
});

describe('buildHeuristicApplyPlan', () => {
  it('routes inferred to todo and observed to merge', () => {
    const plan = buildHeuristicApplyPlan('traffic-monitor', [
      {
        claim: 'inferred claim',
        confidence: 'inferred',
        content: '',
        cue: 'guess',
        id: '1',
        pagePath: 'x',
        topicHint: 'traffic-monitor',
      },
      {
        claim: 'seen claim',
        confidence: 'observed',
        content: '',
        cue: 'HOWTO HKeMobility',
        example: 'example',
        id: '2',
        pagePath: 'y',
        topicHint: 'traffic-monitor',
      },
    ]);

    assert.equal(plan.ops[0]?.op, 'todo');
    assert.equal(plan.ops[1]?.op, 'merge');
  });
});
