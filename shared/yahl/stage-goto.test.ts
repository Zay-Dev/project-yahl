import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertDocumentStageIdsAndGoto } from './assert-stage-goto-graph';
import { validateYahlDocument } from './document-schema';
import { validateYahlStage } from './validate-stage';

describe('validateYahlStage id/goto', () => {
  it('accepts optional id', () => {
    const stage = validateYahlStage({ id: 'explorer', logic: 'const x = 1;' });

    assert.equal(stage.id, 'explorer');
  });

  it('rejects invalid id', () => {
    assert.throws(
      () => validateYahlStage({ id: '1bad', logic: 'const x = 1;' }),
      /id/,
    );
  });

  it('rejects goto on contextMode', () => {
    assert.throws(
      () => validateYahlStage({
        contextMode: true,
        goto: [{ command: '/stage(explorer)', description: 'x' }],
        logic: '(() => ({ a: 1 }));',
      }),
      /goto/,
    );
  });

  it('accepts goto on AI stage', () => {
    const stage = validateYahlStage({
      goto: [{ command: '/stage(explorer)', description: 'when cache dies' }],
      logic: 'const x = 1;',
    });

    assert.equal(stage.goto?.[0]?.command, '/stage(explorer)');
  });
});

describe('assertDocumentStageIdsAndGoto', () => {
  it('rejects duplicate ids', () => {
    assert.throws(
      () => assertDocumentStageIdsAndGoto([
        { id: 'a', logic: '1' },
        { id: 'a', logic: '2' },
      ]),
      /duplicate/,
    );
  });

  it('rejects unknown goto target', () => {
    assert.throws(
      () => assertDocumentStageIdsAndGoto([
        {
          goto: [{ command: '/stage(missing)', description: 'x' }],
          logic: '1',
        },
      ]),
      /unknown stage id/,
    );
  });

  it('accepts valid graph', () => {
    assert.doesNotThrow(() => assertDocumentStageIdsAndGoto([
      { id: 'explorer', logic: '1' },
      {
        goto: [{ command: '/stage(explorer)', description: 'dead source' }],
        id: 'monitor',
        logic: '2',
      },
    ]));
  });
});

describe('validateYahlDocument id/goto', () => {
  it('validates full document goto graph', () => {
    const doc = validateYahlDocument({
      description: 'test',
      name: 'test',
      stages: [
        { id: 'explorer', logic: 'const a = 1;' },
        {
          goto: [{ command: '/stage(explorer)', description: 'rewind' }],
          id: 'monitor',
          logic: 'const b = 2;',
        },
      ],
    });

    assert.equal(doc.stages[0]?.id, 'explorer');
    assert.equal(doc.stages[1]?.goto?.[0]?.command, '/stage(explorer)');
  });
});
