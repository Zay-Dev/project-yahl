import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { parseYahlTask } from './parse-task.js';
import { assertSafeYahlRefPath, isNestedLogic, isYahlLogicRef } from './logic.js';
import { validateYahlStage } from './validate-stage.js';

describe('polymorphic logic', () => {
  it('validates string logic unchanged', () => {
    const stage = validateYahlStage({ logic: 'const x = 1;' });

    assert.equal(stage.logic, 'const x = 1;');
    assert.equal(stage.subAgent, undefined);
  });

  it('defaults subAgent true for inline fragment', () => {
    const stage = validateYahlStage({
      logic: {
        stages: [{ logic: 'const a = 1;' }],
      },
    });

    assert.equal(stage.subAgent, true);
    assert.ok(isNestedLogic(stage.logic));
  });

  it('honors subAgent false for $ref', () => {
    const stage = validateYahlStage({
      logic: { $ref: 'stages/monitor.yahl' },
      subAgent: false,
    });

    assert.equal(stage.subAgent, false);
    assert.ok(isYahlLogicRef(stage.logic));
  });

  it('rejects unsafe $ref paths', () => {
    assert.throws(() => assertSafeYahlRefPath('../x.yahl', 'logic'));
    assert.throws(() => assertSafeYahlRefPath('/abs/x.yahl', 'logic'));
  });

  it('resolves $ref at parse time with taskRoot', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'yahl-ref-'));
    mkdirSync(path.join(root, 'stages'));
    writeFileSync(
      path.join(root, 'stages', 'body.yahl'),
      'stages:\n  - id: inner\n    logic: |\n      const ok = 1;\n',
      'utf8',
    );
    const skillText = [
      'name: ref_task',
      'description: test',
      'stages:',
      '  - id: shell',
      '    logic:',
      '      $ref: stages/body.yahl',
    ].join('\n');
    writeFileSync(path.join(root, 'SKILL.yaml'), skillText, 'utf8');

    const { stages, yahlRefs } = parseYahlTask(skillText, { taskRoot: root });

    assert.equal(stages.length, 1);
    assert.ok(stages[0]?.nestedStages?.length);
    assert.equal(stages[0]?.nestedStages?.[0]?.spec.id, 'inner');
    assert.ok(yahlRefs?.['stages/body.yahl']);
    assert.equal(readFileSync(path.join(root, 'SKILL.yaml'), 'utf8'), skillText);
  });
});
