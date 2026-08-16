import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildHeuristicApplyPlan,
  groupManagerTopics,
  observationValidationReasons,
  resolveManagerDepth,
  shouldUseHeuristicApplyPlan,
} from './run-knowledge-manager.js';
import { validateApplyPlan } from './apply-plan.js';

describe('validateApplyPlan', () => {
  it('accepts merge and transfer ops', () => {
    const validated = validateApplyPlan({
      topic: 'topic-alpha',
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
          targetTopic: 'topic-beta',
          claim: 'shared reusable fact',
          rationale: 'belongs in sibling topic',
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
    const instruction = 'Focus:\n- topic-alpha PLACE quality\n';

    assert.equal(resolveManagerDepth('topic-alpha', instruction), 'focus');
    assert.equal(resolveManagerDepth('other-topic', instruction), 'light');
  });
});

describe('observationValidationReasons', () => {
  it('flags PLACE without bound_poi evidence', () => {
    const reasons = observationValidationReasons({
      claim: 'bind Acme Building',
      confidence: 'observed',
      cue: 'PLACE',
      example: 'clicked River Hub',
      evidence: { task: 'sample_task' },
      tags: ['PLACE'],
    });

    assert.ok(reasons.includes('place_tag'));
    assert.ok(reasons.includes('weak_place_evidence'));
    assert.equal(reasons.includes('landmark_class_mismatch'), false);
  });
});

describe('buildHeuristicApplyPlan', () => {
  it('routes inferred to todo and observed to merge', () => {
    const plan = buildHeuristicApplyPlan('topic-alpha', [
      {
        claim: 'inferred claim',
        confidence: 'inferred',
        content: '',
        cue: 'guess',
        id: '1',
        needsValidation: true,
        pagePath: 'x',
        tags: [],
        topicHint: 'topic-alpha',
        validationReasons: ['inferred_confidence'],
      },
      {
        claim: 'seen claim',
        confidence: 'observed',
        content: '',
        cue: 'HOWTO form fill',
        example: 'example',
        id: '2',
        needsValidation: false,
        pagePath: 'y',
        tags: ['HOWTO'],
        topicHint: 'topic-alpha',
        validationReasons: [],
      },
    ], { placePage: 'facts' });

    assert.equal(plan.ops[0]?.op, 'todo');
    assert.equal(plan.ops[1]?.op, 'merge');
    assert.equal(plan.ops[1]?.page, 'facts');
    assert.equal(plan.ops[1]?.section, 'HOWTO');
  });

  it('routes PLACE to placePage PLACE section and SUMMARY to append_raw', () => {
    const plan = buildHeuristicApplyPlan('topic-alpha', [
      {
        claim: 'Maple Court is Midtown not River Station',
        confidence: 'quoted',
        content: '',
        cue: 'Maple Court location',
        example: 'Oak Street entrance',
        id: '3',
        needsValidation: false,
        pagePath: 'z',
        quote: 'Maple Court ≠ River Station',
        tags: ['PLACE'],
        topicHint: 'topic-alpha',
        validationReasons: [],
      },
      {
        claim: 'daily narrative',
        confidence: 'observed',
        content: '',
        cue: 'daily summary',
        example: 'primary corridor fastest',
        id: '4',
        needsValidation: false,
        pagePath: 'w',
        tags: ['SUMMARY'],
        topicHint: 'topic-alpha',
        validationReasons: [],
      },
    ], { placePage: 'facts' });

    assert.equal(plan.ops[0]?.op, 'merge');
    assert.equal(plan.ops[0]?.page, 'facts');
    assert.equal(plan.ops[0]?.section, 'PLACE');
    assert.match(String(plan.ops[0]?.content ?? ''), /Maple Court|River Station/);
    assert.equal(plan.ops[1]?.op, 'append_raw');
  });

  it('rehomes when topicHint differs from managed topic', () => {
    const plan = buildHeuristicApplyPlan('traffic-monitor', [
      {
        claim: 'propose-notification needs direction to_user and body',
        confidence: 'observed',
        content: '',
        cue: 'WhatsApp propose-notification',
        example: 'succeeded after adding direction',
        id: 'n1',
        needsValidation: false,
        pagePath: 'n',
        tags: ['HOWTO', 'TRICK'],
        topicHint: 'notifications',
        validationReasons: [],
      },
    ], { placePage: 'facts' });

    assert.equal(plan.ops[0]?.op, 'merge');
    assert.equal(plan.ops[0]?.targetTopic, 'notifications');
    assert.equal(plan.ops[0]?.section, 'HOWTO');
  });
});

describe('shouldUseHeuristicApplyPlan', () => {
  it('forces heuristic for large inboxes or many PLACE tags', () => {
    const small = Array.from({ length: 3 }, (_, index) => ({
      claim: `c${index}`,
      confidence: 'observed',
      content: '',
      cue: 'x',
      id: String(index),
      needsValidation: false,
      pagePath: 'p',
      tags: [] as string[],
      topicHint: 't',
      validationReasons: [] as string[],
    }));

    assert.equal(shouldUseHeuristicApplyPlan(small), false);

    const manyPlace = Array.from({ length: 3 }, (_, index) => ({
      ...small[0],
      id: `p${index}`,
      tags: ['PLACE'],
    }));

    assert.equal(shouldUseHeuristicApplyPlan(manyPlace), true);

    const large = Array.from({ length: 15 }, (_, index) => ({
      ...small[0],
      id: `n${index}`,
      tags: [],
    }));

    assert.equal(shouldUseHeuristicApplyPlan(large), true);
  });
});

describe('groupManagerTopics', () => {
  it('clusters shared slug prefixes and leaves solos', () => {
    const groups = groupManagerTopics([
      'alpha-one',
      'alpha-two',
      'lonely-topic',
    ]);

    const alpha = groups.find((group) => group.id === 'prefix-alpha');

    assert.ok(alpha);
    assert.deepEqual(alpha?.topics, ['alpha-one', 'alpha-two']);
    assert.equal(alpha?.canonical, 'alpha-one');
    assert.ok(groups.some((group) => group.id === 'solo-lonely-topic'));
  });

  it('keeps plural twins in the same prefix cluster', () => {
    const groups = groupManagerTopics([
      'platform',
      'platform-notification',
      'platform-notifications',
      'platform-propose-knowledge-transfer',
    ]);

    const platform = groups.find((group) => group.id === 'prefix-platform');

    assert.ok(platform);
    assert.equal(platform?.canonical, 'platform');
    assert.deepEqual(platform?.topics, [
      'platform',
      'platform-notification',
      'platform-notifications',
      'platform-propose-knowledge-transfer',
    ]);
  });

  it('leaves notifications separate from platform (affinity is skill-owned)', () => {
    const groups = groupManagerTopics([
      'notifications',
      'platform',
      'platform-notification',
      'platform-notifications',
      'lonely-topic',
    ]);

    const platform = groups.find((group) => group.id === 'prefix-platform');

    assert.ok(platform);
    assert.equal(platform?.canonical, 'platform');
    assert.deepEqual(platform?.topics, [
      'platform',
      'platform-notification',
      'platform-notifications',
    ]);
    assert.ok(groups.some((group) => group.id === 'solo-notifications'));
    assert.ok(groups.some((group) => group.id === 'solo-lonely-topic'));
  });

  it('does not merge holidays with weather under a shared geo prefix', () => {
    const groups = groupManagerTopics([
      'hk-morning-traffic',
      'hk-public-holidays',
      'hk-weather',
    ]);

    assert.ok(!groups.some((group) => (group.topics?.length ?? 0) >= 2
      && group.topics.includes('hk-weather')
      && group.topics.includes('hk-public-holidays')));
    assert.ok(groups.some((group) => group.topics.length === 1 && group.topics[0] === 'hk-public-holidays'));
    assert.ok(groups.some((group) => group.topics.length === 1 && group.topics[0] === 'hk-weather'));
    assert.ok(groups.some((group) => group.topics.length === 1 && group.topics[0] === 'hk-morning-traffic'));
  });

  it('still clusters same-domain traffic siblings', () => {
    const groups = groupManagerTopics([
      'traffic-monitor',
      'traffic-monitor-notify',
      'traffic-notify',
    ]);
    const traffic = groups.find((group) => (group.topics?.length ?? 0) >= 2);

    assert.ok(traffic);
    assert.deepEqual(traffic?.topics, [
      'traffic-monitor',
      'traffic-monitor-notify',
      'traffic-notify',
    ]);
  });
});
