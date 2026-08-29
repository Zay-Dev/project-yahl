import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validateYahlStage } from './validate-stage';
import {
  assertYahlStageRefShell,
  resolveMainThreadFlag,
} from './logic';
import { loadYahlStageFromRef } from './resolve-yahl-ref';

describe('mainThread', () => {
  it('defaults nested stages to isolated (mainThread false)', () => {
    const stage = validateYahlStage({
      id: 'fetch',
      logic: 'x = 1;',
    }, 0, { nested: true });

    assert.equal(stage.mainThread, undefined);
    assert.equal(resolveMainThreadFlag(stage), false);
  });

  it('honors mainThread true on nested stages', () => {
    const stage = validateYahlStage({
      id: 'step',
      logic: 'x = 1;',
      mainThread: true,
    }, 0, { nested: true });

    assert.equal(stage.mainThread, true);
    assert.equal(resolveMainThreadFlag(stage), true);
  });

  it('rejects mainThread on fragment/$ref shells', () => {
    assert.throws(
      () => validateYahlStage({
        logic: { stages: [{ logic: 'a = 1;' }] },
        mainThread: true,
      }),
      /mainThread/,
    );
  });

  it('rejects removed subAgent field', () => {
    assert.throws(
      () => validateYahlStage({
        logic: 'a = 1;',
        subAgent: true,
      }),
      /subAgent/,
    );
  });

  it('defaults string shell without mainThread', () => {
    const stage = validateYahlStage({ logic: 'a = 1;' });

    assert.equal(stage.mainThread, undefined);
  });
});

describe('prefixOverride', () => {
  it('accepts prefixOverride on whileSetup stages', () => {
    const stage = validateYahlStage({
      logic: 'c += 1;',
      prefixOverride: 'Warm-up already ran.',
      whileSetup: 'context.context.c < 2',
      warmUp: 'c += 0;',
    });

    assert.equal(stage.prefixOverride, 'Warm-up already ran.');
  });

  it('rejects empty prefixOverride', () => {
    assert.throws(
      () => validateYahlStage({
        logic: 'c += 1;',
        prefixOverride: '   ',
        whileSetup: 'true',
      }),
      /prefixOverride/,
    );
  });

  it('rejects prefixOverride without loop/while', () => {
    assert.throws(
      () => validateYahlStage({
        logic: 'c += 1;',
        prefixOverride: 'hi',
      }),
      /prefixOverride requires/,
    );
  });
});

describe('stage $ref shell', () => {
  it('allows id + $ref only', () => {
    const shell = assertYahlStageRefShell({
      $ref: 'stages/monitor.yahl',
      id: 'monitor',
    }, 'stages[0]');

    assert.equal(shell.$ref, 'stages/monitor.yahl');
    assert.equal(shell.id, 'monitor');
  });

  it('rejects extra shell keys', () => {
    assert.throws(
      () => assertYahlStageRefShell({
        $ref: 'stages/monitor.yahl',
        id: 'monitor',
        warmUp: 'x',
      }, 'stages[0]'),
      /may only set id and \$ref/,
    );
  });

  it('loads a full stage document and applies shell id', () => {
    const stage = loadYahlStageFromRef(
      { $ref: 'stage.yahl', id: 'monitor' },
      {
        taskRoot: '/task',
        readFile: () => `
whileSetup: "context.context.c < 2"
warmUp: |
  c += 0;
prefixOverride: |
  continue
logic: |
  c += 1;
`,
      },
    );

    assert.equal(stage.id, 'monitor');
    assert.equal(stage.warmUp, 'c += 0;');
    assert.equal(stage.prefixOverride, 'continue');
    assert.equal(stage.logic, 'c += 1;');
  });

  it('rejects file id mismatch', () => {
    assert.throws(
      () => loadYahlStageFromRef(
        { $ref: 'stage.yahl', id: 'monitor' },
        {
          taskRoot: '/task',
          readFile: () => `
id: other
logic: "x = 1;"
whileSetup: "true"
`,
        },
      ),
      /must match shell id/,
    );
  });
});
