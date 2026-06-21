import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  resolveFreshStageForVerifyResume,
  resolveVerifyResumeEnabled,
  toVerifyStageSnapshot,
} from '@/orchestrator/-verify/stage-snapshot';

describe('toVerifyStageSnapshot', () => {
  it('includes askUser, logic, and produceContextKeys', () => {
    const snapshot = toVerifyStageSnapshot({
      askUser: [{ id: 'target_metric', question: 'metric?' }],
      contextKeys: ['draft'],
      logic: 'const x = 1;',
      produceContextKeys: ['draft_with_metric'],
    });

    assert.equal(snapshot.logic, 'const x = 1;');
    assert.deepEqual(snapshot.contextKeys, ['draft']);
    assert.deepEqual(snapshot.produceContextKeys, ['draft_with_metric']);
    assert.equal(snapshot.askUser?.length, 1);
  });
});

describe('resolveVerifyResumeEnabled', () => {
  it('defaults to true when askUser is present', () => {
    assert.equal(resolveVerifyResumeEnabled({
      askUser: [{ id: '1', question: 'pick' }],
      logic: 'x',
    }), true);
  });

  it('returns false when verifyResume is false', () => {
    assert.equal(resolveVerifyResumeEnabled({
      askUser: [{ id: '1', question: 'pick' }],
      logic: 'x',
      verifyResume: false,
    }), false);
  });
});

describe('resolveFreshStageForVerifyResume', () => {
  it('reloads YAML logic without inlined ask-user answers', () => {
    const yahlStages = [{
      lines: '{\nconst metricAnswer = /ask-user(target_metric);\n}',
      sourceStartLine: 18,
      spec: {
        askUser: [{ id: 'target_metric', question: 'metric?' }],
        logic: 'const metricAnswer = /ask-user(target_metric);',
      },
      type: 'plain' as const,
    }];

    const fresh = resolveFreshStageForVerifyResume(
      0,
      yahlStages,
      {
        askUser: [{ answer: 'abc', id: 'target_metric', question: 'metric?' }],
        logic: 'const metricAnswer = "abc";',
      },
    );

    assert.match(fresh?.spec.logic ?? '', /\/ask-user\(target_metric\)/);
    assert.equal(fresh?.spec.askUser?.[0]?.answer, undefined);
  });
});
