import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TParsedStage } from '@project-yahl/server/modules/sessions/-types';

import {
  laterOriginalStageLabel,
  laterOriginalStagesForRerun,
} from './rerun-later-stages';

const parsed = (logic: string, extras: Partial<TParsedStage> = {}): TParsedStage => {
  const { spec, type, ...rest } = extras;

  return {
    lines: logic,
    sourceStartLine: 1,
    spec: { logic, ...spec },
    type: type ?? 'plain',
    ...rest,
  };
};

const testTaskOriginalStages: TParsedStage[] = [
  parsed('const base = { a: 1, b: 2 };', {
    spec: { logic: 'const base = { a: 1, b: 2 };', contextMode: true },
  }),
  parsed('(() => ({ c: context.context.c + context.context.i }));', {
    spec: {
      logic: '(() => ({ c: context.context.c + context.context.i }));',
      loopSetup: 'for each i of [1..5]',
    },
    type: 'loop',
  }),
  parsed('c += i;', {
    spec: {
      id: 'step_loop',
      logic: 'c += i;',
      loopSetup: 'for each i of [1..5,+2]',
    },
    type: 'loop',
  }),
  parsed('IF: c < 30;\n  /stage(step_loop);\nEND:', {
    spec: {
      goto: [{ command: '/stage(step_loop)', description: 'when c is less than 30' }],
      logic: 'IF: c < 30;\n  /stage(step_loop);\nEND:',
    },
  }),
  parsed('IF: context.context.c % 2 === 0;', {
    spec: {
      conditionMode: true,
      logic: 'IF: context.context.c % 2 === 0;\n  (() => ({ c: context.context.c * 2 }));\nEND:',
    },
  }),
  parsed('c += /ask-user(1);', {
    spec: { logic: 'c += /ask-user(1);' },
  }),
  parsed('const result = {a,b,c};', {
    spec: { logic: 'const result = {a,b,c};' },
  }),
  parsed('(() => ({ result: context.context.result }));', {
    spec: {
      contextMode: true,
      logic: '(() => ({ result: context.context.result }));',
    },
  }),
];

describe('laterOriginalStagesForRerun', () => {
  it('returns original slots after the anchor parsedStageIndex', () => {
    const parsedStages = [
      parsed('base'),
      parsed('loop', { type: 'loop' }),
      parsed('goto'),
      parsed('condition'),
      parsed('ask'),
      parsed('result'),
    ];

    const later = laterOriginalStagesForRerun(parsedStages, 2);

    assert.deepEqual(later.map((item) => item.parsedStageIndex), [3, 4, 5]);
    assert.deepEqual(later.map((item) => item.parsed.spec.logic), [
      'condition',
      'ask',
      'result',
    ]);
  });

  it('after test-task goto does not list extra executed step_loop iterations', () => {
    const later = laterOriginalStagesForRerun(testTaskOriginalStages, 3);

    assert.deepEqual(later.map((item) => item.parsedStageIndex), [4, 5, 6, 7]);
    assert.equal(later.some((item) => item.parsed.spec.conditionMode === true), true);
    assert.match(later[1]?.parsed.spec.logic ?? '', /ask-user/);
    assert.match(later[2]?.parsed.spec.logic ?? '', /const result = \{a,b,c\}/);
    assert.equal(
      later.filter((item) => item.parsed.spec.logic.trim() === 'c += i;').length,
      0,
    );
  });

  it('ignores executed timeline length; one original slot is one candidate', () => {
    const executedTimelineLength = 18;
    const later = laterOriginalStagesForRerun(testTaskOriginalStages, 3);

    assert.equal(later.length, 4);
    assert.notEqual(later.length, executedTimelineLength - 1 - 3);
  });

  it('returns an empty list when the anchor is the last original slot', () => {
    const later = laterOriginalStagesForRerun([parsed('only')], 0);

    assert.deepEqual(later, []);
  });

  it('returns an empty list when parsedStageIndex is missing', () => {
    const later = laterOriginalStagesForRerun([parsed('a'), parsed('b')], undefined);

    assert.deepEqual(later, []);
  });
});

describe('laterOriginalStageLabel', () => {
  it('uses task slot numbers, not timeline loop suffixes', () => {
    assert.equal(laterOriginalStageLabel(parsed('condition'), 4), 'task #5');
    assert.equal(
      laterOriginalStageLabel(
        parsed('c += i;', { spec: { id: 'step_loop', logic: 'c += i;' } }),
        2,
      ),
      'step_loop (task #3)',
    );
    assert.doesNotMatch(laterOriginalStageLabel(parsed('x'), 4), /\.\d+$/);
    assert.doesNotMatch(laterOriginalStageLabel(parsed('x'), 4), /^#\d+\.\d+/);
  });
});
