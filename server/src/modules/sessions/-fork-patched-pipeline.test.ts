import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { parseYahlTask } from '@project-yahl/shared/yahl/parse-task';

import type { TResponseStageReplayItem } from './-api-types';
import type { TYahlStage } from './-types';

import { buildForkPatchedParsedStages } from './-fork-patched-pipeline';

const testTaskYahl = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../tasks/test/SKILL.yahl'),
  'utf8',
);

const replayRow = (
  stageId: string,
  stage: TYahlStage,
  overrides: Partial<TResponseStageReplayItem> = {},
): TResponseStageReplayItem => ({
  context: {},
  requestId: `r-${stageId}`,
  stage,
  stageId,
  ...overrides,
});

const loopBody = '(() => ({\n  c: context.context.c + context.context.i,\n}))';

describe('buildForkPatchedParsedStages', () => {
  it('patches canonical slot 5 when replay row has corrupt parsedStageIndex', () => {
    const baseline = parseYahlTask(testTaskYahl).stages;

    assert.equal(baseline[5]?.spec.temperature, 2);

    const replayRows: TResponseStageReplayItem[] = [
      replayRow('base', {
        logic: 'const base = { a: 1, b: 2 };',
        contextMode: true,
      }, { parsedStageIndex: 0, sourceStartLine: 9 }),
      ...Array.from({ length: 5 }, (_, index) => replayRow(
        `loop1-${index}`,
        { logic: loopBody },
        { parsedStageIndex: 1, sourceStartLine: 22, loopMeta: { arraySnapshot: [1, 2, 3, 4, 5], index, value: index + 1 } },
      )),
      ...Array.from({ length: 3 }, (_, index) => replayRow(
        `loop2-${index}`,
        { logic: 'c += i;', temperature: 0.2, loopSetup: 'for each i of [1..5,+2]' },
        { parsedStageIndex: 2, sourceStartLine: 31, loopMeta: { arraySnapshot: [1, 3, 5], index, value: index * 2 + 1 } },
      )),
      replayRow('condition', {
        logic: 'IF: context.context.c % 2 === 0;\n  (() => ({ c: context.context.c * 2 }));\nEND:',
        conditionMode: true,
      }, { parsedStageIndex: 3, sourceStartLine: 37 }),
      replayRow('anchor', { logic: 'c += /ask-user(1);' }, { parsedStageIndex: 4, sourceStartLine: 1 }),
      replayRow('temp-stage', {
        logic: 'const result = {a,b,c};',
        temperature: 2,
      }, { parsedStageIndex: 1, sourceStartLine: 22 }),
      replayRow('tail', {
        logic: '(() => ({ result: context.context.result }));',
        contextMode: true,
      }, { parsedStageIndex: 2, sourceStartLine: 31 }),
    ];

    const anchorIndex = 10;

    const { anchorParsedStageIndex, parsedStages } = buildForkPatchedParsedStages({
      anchorIndex,
      anchorStageId: 'anchor',
      replayRows,
      setups: [
        {
          context: {},
          stage: { logic: 'c += /ask-user(1);', askUser: [{ id: '1', question: 'q' }] },
          stageId: 'anchor',
        },
        {
          context: {},
          stage: { logic: 'const result = {a,b,c};', contextKeys: ['a', 'b', 'c'], produceContextKeys: ['result'] },
          stageId: 'temp-stage',
        },
        {
          context: {},
          stage: { logic: '(() => ({ result: context.context.result }));', contextMode: true },
          stageId: 'tail',
        },
      ],
      taskYahl: testTaskYahl,
    });

    assert.equal(anchorParsedStageIndex, 4);
    assert.equal(parsedStages[5]?.spec.temperature, undefined);
    assert.equal(parsedStages[5]?.temperature, undefined);
    assert.match(parsedStages[5]?.spec.logic ?? '', /const result = \{a,b,c\}/);
  });

  it('prefers user-submitted setup for a loop slot over replay default', () => {
    const taskYahl = [
      'name: loop-fork',
      'description: loop fork test',
      'resultContextKey: result',
      'stages:',
      '  - loopSetup: for each i of [1..2]',
      '    logic: |',
      '      c += i;',
    ].join('\n');

    const replayRows = [
      replayRow('anchor', { logic: 'c += i;', temperature: 0.5, loopSetup: 'for each i of [1..2]' }, {
        loopMeta: { arraySnapshot: [1, 2], index: 0, value: 1, temperature: 0.5 },
        parsedStageIndex: 0,
      }),
      replayRow('loop-iter-2', { logic: 'c += i;', temperature: 0.5, loopSetup: 'for each i of [1..2]' }, {
        loopMeta: { arraySnapshot: [1, 2], index: 1, value: 2, temperature: 0.5 },
        parsedStageIndex: 0,
      }),
    ];

    const { parsedStages } = buildForkPatchedParsedStages({
      anchorIndex: 0,
      anchorStageId: 'anchor',
      replayRows,
      setups: [
        {
          context: {},
          loopMeta: { arraySnapshot: [1, 2], index: 0, value: 1 },
          stage: { logic: 'c += i-edited;', loopSetup: 'for each i of [1..2]' },
          stageId: 'anchor',
        },
        {
          context: {},
          loopMeta: { arraySnapshot: [1, 2], index: 1, value: 2, temperature: 0.5 },
          stage: { logic: 'c += i;', temperature: 0.5, loopSetup: 'for each i of [1..2]' },
          stageId: 'loop-iter-2',
        },
      ],
      taskYahl,
    });

    assert.match(parsedStages[0]?.spec.logic ?? '', /c \+= i-edited/);
    assert.equal(parsedStages[0]?.spec.temperature, undefined);
    assert.equal(parsedStages[0]?.temperature, undefined);
  });

  it('keeps temperature on unedited replay-filled later stages', () => {
    const replayRows: TResponseStageReplayItem[] = [
      replayRow('base', { logic: 'const base = { a: 1, b: 2 };', contextMode: true }, { parsedStageIndex: 0 }),
      ...Array.from({ length: 5 }, (_, index) => replayRow(
        `loop1-${index}`,
        { logic: loopBody },
        { parsedStageIndex: 1, loopMeta: { arraySnapshot: [1, 2, 3, 4, 5], index, value: index + 1 } },
      )),
      ...Array.from({ length: 3 }, (_, index) => replayRow(
        `loop2-${index}`,
        { logic: 'c += i;', temperature: 0.2 },
        { parsedStageIndex: 2, loopMeta: { arraySnapshot: [1, 3, 5], index, value: index * 2 + 1 } },
      )),
      replayRow('condition', { logic: 'IF: END:', conditionMode: true }, { parsedStageIndex: 3 }),
      replayRow('anchor', { logic: 'c += /ask-user(1);' }, { parsedStageIndex: 4 }),
      replayRow('temp-stage', { logic: 'const result = {a,b,c};', temperature: 2 }, { parsedStageIndex: 1 }),
    ];

    const { parsedStages } = buildForkPatchedParsedStages({
      anchorIndex: 10,
      anchorStageId: 'anchor',
      replayRows,
      setups: [
        {
          context: {},
          stage: { logic: 'c += /ask-user(1);' },
          stageId: 'anchor',
        },
        {
          context: {},
          stage: { logic: 'const result = {a,b,c};', temperature: 2 },
          stageId: 'temp-stage',
        },
      ],
      taskYahl: testTaskYahl,
    });

    assert.equal(parsedStages[5]?.spec.temperature, 2);
    assert.equal(parsedStages[5]?.temperature, 2);
  });
});
