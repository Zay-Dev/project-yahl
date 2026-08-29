import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { logicPreviewText } from '@project-yahl/shared/yahl/logic';
import { parseYahlTask } from '@project-yahl/shared/yahl/parse-task';

import type { TResponseStageReplayItem } from './-api-types';
import type { TYahlStage } from './-types';

import { buildForkPatchedParsedStages, deriveForkStorageSeed, prefixRowsForForkCopy } from './-fork-patched-pipeline';
import { parseSessionYahlTask } from './-parse-session-yahl';

const logicText = (logic: TYahlStage['logic'] | undefined) =>
  logicPreviewText(logic);

const testTaskYahl = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../tasks/test/SKILL.yaml'),
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
  it('parses traffic_monitor $ref taskYahl with taskId (fork path)', () => {
    const trafficYahl = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../../tasks/traffic_monitor/SKILL.yaml'),
      'utf8',
    );
    const monitorRef = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../../tasks/traffic_monitor/stages/monitor.yahl'),
      'utf8',
    );

    const { stages } = parseSessionYahlTask(trafficYahl, {
      taskId: 'traffic_monitor',
      taskYahlRefs: { 'stages/monitor.yahl': monitorRef },
    });
    const monitor = stages.find((stage) => stage.spec.id === 'monitor');

    assert.equal(monitor?.type, 'while');
    assert.ok((monitor?.nestedStages?.length ?? 0) >= 4);
    assert.equal(monitor?.nestedStages?.[0]?.spec.id, 'submit_wait');
    assert.equal(monitor?.nestedStages?.[1]?.spec.id, 'extract');
    assert.equal(monitor?.nestedStages?.[3]?.spec.id, 'notify_and_sleep');
  });
  it('keeps original slots after a goto anchor when replay has extra loop rows', () => {
    const baseline = parseYahlTask(testTaskYahl).stages;
    const gotoIndex = baseline.findIndex((stage) => (stage.spec.goto?.length ?? 0) > 0);
    const stepLoopIndex = baseline.findIndex((stage) => stage.spec.id === 'step_loop');

    assert.equal(gotoIndex >= 0, true);
    assert.equal(stepLoopIndex >= 0, true);

    const replayRows: TResponseStageReplayItem[] = [
      replayRow('base', {
        logic: 'const base = { a: 1, b: 2 };',
        contextMode: true,
      }, { parsedStageIndex: 0 }),
      ...Array.from({ length: 5 }, (_, index) => replayRow(
        `loop1-${index}`,
        { logic: loopBody },
        { parsedStageIndex: 1, loopMeta: { arraySnapshot: [1, 2, 3, 4, 5], index, value: index + 1 } },
      )),
      ...Array.from({ length: 3 }, (_, index) => replayRow(
        `loop2-${index}`,
        { logic: 'c += i;', temperature: 0.2, loopSetup: 'for each i of [1..5,+2]' },
        { parsedStageIndex: 2, loopMeta: { arraySnapshot: [1, 3, 5], index, value: index * 2 + 1 } },
      )),
      replayRow('goto', {
        logic: 'IF: c < 30;\n  /stage(step_loop);\nEND:',
        goto: [{ command: '/stage(step_loop)', description: 'when c is less than 30' }],
      }, { parsedStageIndex: gotoIndex }),
      ...Array.from({ length: 3 }, (_, index) => replayRow(
        `loop2-rerun-${index}`,
        { logic: 'c += i;', temperature: 0.2, loopSetup: 'for each i of [1..5,+2]' },
        { parsedStageIndex: stepLoopIndex, loopMeta: { arraySnapshot: [1, 3, 5], index, value: index * 2 + 1 } },
      )),
      replayRow('condition', {
        logic: 'IF: context.context.c % 2 === 0;',
        conditionMode: true,
      }, { parsedStageIndex: gotoIndex + 1 }),
    ];

    const anchorIndex = replayRows.findIndex((row) => row.stageId === 'goto');

    const { anchorParsedStageIndex, parsedStages } = buildForkPatchedParsedStages({
      anchorIndex,
      anchorStageId: 'goto',
      replayRows,
      setups: [
        {
          context: {},
          stage: {
            logic: 'IF: c < 10;\n  /stage(step_loop);\nEND:',
            goto: [{ command: '/stage(step_loop)', description: 'when c is less than 10' }],
          },
          stageId: 'goto',
        },
      ],
      taskYahl: testTaskYahl,
    });

    assert.equal(anchorParsedStageIndex, gotoIndex);
    assert.match(logicText(parsedStages[gotoIndex]?.spec.logic), /c < 10/);
    assert.equal(parsedStages[gotoIndex + 1]?.spec.conditionMode, true);
    assert.equal(parsedStages[gotoIndex + 1]?.spec.logic, baseline[gotoIndex + 1]?.spec.logic);
    assert.equal(parsedStages[stepLoopIndex]?.spec.id, 'step_loop');
    assert.equal(parsedStages[stepLoopIndex]?.type, 'loop');
    assert.equal(parsedStages[stepLoopIndex]?.spec.logic, baseline[stepLoopIndex]?.spec.logic);
  });

  it('leaves unedited later YAML unchanged when the user sends only the anchor', () => {
    const baseline = parseYahlTask(testTaskYahl).stages;
    const askIndex = baseline.findIndex((stage) => (stage.spec.askUser?.length ?? 0) > 0);

    assert.equal(askIndex >= 0, true);

    const replayRows = [
      replayRow('prefix', { logic: 'const base = { a: 1 };' }, { parsedStageIndex: 0 }),
      replayRow('anchor', { logic: 'c += /ask-user(1);' }, { parsedStageIndex: askIndex }),
      replayRow('result', { logic: 'const result = {a,b,c};', temperature: 0.5 }, { parsedStageIndex: askIndex + 1 }),
    ];

    const { parsedStages } = buildForkPatchedParsedStages({
      anchorIndex: 1,
      anchorStageId: 'anchor',
      replayRows,
      setups: [
        {
          context: {},
          stage: { logic: 'c += /ask-user(1);', askUser: [{ id: '1', question: 'q' }] },
          stageId: 'anchor',
        },
      ],
      taskYahl: testTaskYahl,
    });

    assert.equal(parsedStages[askIndex + 1]?.spec.logic, baseline[askIndex + 1]?.spec.logic);
    assert.equal(parsedStages[askIndex + 1]?.spec.temperature, baseline[askIndex + 1]?.spec.temperature);
    assert.equal(parsedStages[askIndex + 2]?.spec.logic, baseline[askIndex + 2]?.spec.logic);
  });

  it('patches only a user-edited later original slot', () => {
    const baseline = parseYahlTask(testTaskYahl).stages;
    const askIndex = baseline.findIndex((stage) => (stage.spec.askUser?.length ?? 0) > 0);
    const resultIndex = askIndex + 1;

    const replayRows = [
      replayRow('anchor', { logic: 'c += /ask-user(1);' }, { parsedStageIndex: askIndex }),
    ];

    const { parsedStages } = buildForkPatchedParsedStages({
      anchorIndex: 0,
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
          parsedStageIndex: resultIndex,
          stage: { logic: 'const result = { edited: true };', produceContextKeys: ['result'] },
          stageId: `parsed:${resultIndex}`,
        },
      ],
      taskYahl: testTaskYahl,
    });

    assert.match(logicText(parsedStages[resultIndex]?.spec.logic), /edited: true/);
    assert.equal(parsedStages[resultIndex + 1]?.spec.logic, baseline[resultIndex + 1]?.spec.logic);
  });

  it('compiles a loop anchor as the current iteration without unrolling onto later slots', () => {
    const taskYahl = [
      'name: loop-fork',
      'description: loop fork test',
      'resultContextKey: result',
      'stages:',
      '  - loopSetup: for each i of [1..2]',
      '    logic: |',
      '      c += i;',
      '  - logic: |',
      '      const result = { c };',
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
      ],
      taskYahl,
    });

    assert.match(logicText(parsedStages[0]?.spec.logic), /c \+= i-edited/);
    assert.equal(parsedStages[0]?.type, 'plain');
    assert.match(logicText(parsedStages[1]?.spec.logic), /const result = \{ c \}/);
    assert.equal(parsedStages[1]?.type, 'plain');
  });

  it('falls back to unique prefix slot count when the anchor omits parsedStageIndex', () => {
    const baseline = parseYahlTask(testTaskYahl).stages;
    const askIndex = baseline.findIndex((stage) => (stage.spec.askUser?.length ?? 0) > 0);

    const replayRows = [
      replayRow('base', { logic: 'const base = { a: 1 };' }, { parsedStageIndex: 0 }),
      replayRow('loop', { logic: loopBody }, { parsedStageIndex: 1 }),
      replayRow('anchor', { logic: 'c += /ask-user(1);' }),
    ];

    const { anchorParsedStageIndex } = buildForkPatchedParsedStages({
      anchorIndex: 2,
      anchorStageId: 'anchor',
      replayRows,
      setups: [
        {
          context: {},
          stage: { logic: 'c += /ask-user(1);' },
          stageId: 'anchor',
        },
      ],
      taskYahl: testTaskYahl,
    });

    assert.equal(anchorParsedStageIndex, 2);
    assert.equal(askIndex >= 2, true);
  });

  it('keeps prefix replay rows for fast-forward copy', () => {
    const replayRows = [
      replayRow('a', { logic: 'a' }, { parsedStageIndex: 0, contextAfter: { context: { a: 1 } } }),
      replayRow('b', { logic: 'b' }, { parsedStageIndex: 1, contextAfter: { context: { b: 1 } } }),
      replayRow('anchor', { logic: 'c' }, { parsedStageIndex: 2 }),
    ];

    const prefix = prefixRowsForForkCopy(replayRows, 2);

    assert.deepEqual(prefix.map((row) => row.stageId), ['a', 'b']);
  });

  it('fold-merges nested prefix contextAfter so later filtered rows keep earlier keys', () => {
    const fetches = [{ fetched_at: 't', routes: [] }];
    const traffic_source = { name: 'maps', url: 'https://example' };
    const replayRows = [
      replayRow('pre', { logic: 'pre' }, {
        contextAfter: { context: { fetches, traffic_source, day_page: 'raw/x' } },
        parsedStageIndex: 9,
      }),
      replayRow('analyze', { logic: 'analyze', id: 'analyze' }, {
        agentMeta: {
          isMainThread: false,
          nestedIndex: 6,
          nestedPath: 'monitor/analyze',
        },
        contextAfter: {
          context: { fetches, poll_success_count: 1, prev_routes: [{ eta_min: 12 }] },
        },
        loopMeta: { arraySnapshot: [], index: 1, kind: 'while', value: 1 },
        parsedStageIndex: 10,
      }),
      replayRow('notify', { logic: 'notify', id: 'notify' }, {
        agentMeta: {
          isMainThread: false,
          nestedIndex: 7,
          nestedPath: 'monitor/notify',
        },
        contextAfter: { context: { notifications: [], summary_notified: true } },
        loopMeta: { arraySnapshot: [], index: 1, kind: 'while', value: 1 },
        parsedStageIndex: 10,
      }),
      replayRow('sleep', { logic: 'sleep', id: 'sleep' }, {
        agentMeta: {
          isMainThread: false,
          nestedIndex: 8,
          nestedPath: 'monitor/sleep',
        },
        loopMeta: { arraySnapshot: [], index: 1, kind: 'while', value: 1 },
        parsedStageIndex: 10,
      }),
    ];

    const seed = deriveForkStorageSeed(replayRows, 3, {
      context: {},
      stage: { logic: 'sleep', id: 'sleep' },
      stageId: 'sleep',
    });
    const context = seed.context as Record<string, unknown>;

    assert.deepEqual(context.fetches, fetches);
    assert.deepEqual(context.traffic_source, traffic_source);
    assert.equal(context.day_page, 'raw/x');
    assert.equal(context.poll_success_count, 1);
    assert.deepEqual(context.notifications, []);
    assert.equal(context.summary_notified, true);
  });

  it('keeps while nestedStages when forking from a nested child', () => {
    const trafficYahl = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../../tasks/traffic_monitor/SKILL.yaml'),
      'utf8',
    );
    const monitorRef = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../../tasks/traffic_monitor/stages/monitor.yahl'),
      'utf8',
    );
    const baseline = parseSessionYahlTask(trafficYahl, {
      taskId: 'traffic_monitor',
      taskYahlRefs: { 'stages/monitor.yahl': monitorRef },
    }).stages;
    const monitorIndex = baseline.findIndex((stage) => stage.spec.id === 'monitor');
    const nested = baseline[monitorIndex]!.nestedStages ?? [];
    const anchorChild = nested.find((stage) => stage.spec.id === 'notify_and_sleep');
    const priorChild = nested.find((stage) => stage.spec.id === 'analyze');

    assert.ok(anchorChild);
    assert.ok(priorChild);

    const replayRows: TResponseStageReplayItem[] = [
      replayRow('pre', { logic: 'x = 1;' }, {
        contextAfter: { context: { x: 1 } },
        parsedStageIndex: monitorIndex - 1,
      }),
      replayRow('extract', { logic: 'extract', id: 'extract' }, {
        agentMeta: {
          isMainThread: false,
          nestedIndex: 1,
          nestedPath: 'monitor/extract',
        },
        contextAfter: { context: { last_fetch: { routes: [] } } },
        loopMeta: { arraySnapshot: [], index: 1, kind: 'while', value: 1 },
        parsedStageIndex: monitorIndex,
      }),
      replayRow('analyze', priorChild!.spec, {
        agentMeta: {
          isMainThread: false,
          nestedIndex: 2,
          nestedPath: 'monitor/analyze',
        },
        contextAfter: { context: { fetches: [], poll_success_count: 1 } },
        loopMeta: { arraySnapshot: [], index: 1, kind: 'while', value: 1 },
        parsedStageIndex: monitorIndex,
      }),
      replayRow('notify_and_sleep', anchorChild!.spec, {
        agentMeta: {
          isMainThread: false,
          nestedIndex: 3,
          nestedPath: 'monitor/notify_and_sleep',
        },
        loopMeta: { arraySnapshot: [], index: 1, kind: 'while', value: 1 },
        parsedStageIndex: monitorIndex,
      }),
    ];

    const { anchorParsedStageIndex, nestedIndex, parsedStages } = buildForkPatchedParsedStages({
      anchorIndex: 3,
      anchorStageId: 'notify_and_sleep',
      replayRows,
      setups: [{
        context: {},
        loopMeta: { arraySnapshot: [], index: 1, kind: 'while', value: 1 },
        stage: anchorChild!.spec,
        stageId: 'notify_and_sleep',
      }],
      taskId: 'traffic_monitor',
      taskYahl: trafficYahl,
      taskYahlRefs: { 'stages/monitor.yahl': monitorRef },
    });

    assert.equal(anchorParsedStageIndex, monitorIndex);
    assert.equal(nestedIndex, 3);
    assert.equal(parsedStages[monitorIndex]?.type, 'while');
    assert.equal(parsedStages[monitorIndex]?.spec.id, 'monitor');
    assert.ok((parsedStages[monitorIndex]?.nestedStages?.length ?? 0) >= 4);

    const prefix = prefixRowsForForkCopy(replayRows, 3);

    assert.deepEqual(prefix.map((row) => row.stageId), ['pre', 'extract', 'analyze']);
    assert.ok(prefix.every((row) => row.stageId === 'pre' || row.agentMeta));
  });
});
