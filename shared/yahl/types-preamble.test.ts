import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isTypesPreambleStage, parseTypesFromPreamble } from './types-preamble.js';
import type { TParsedStage } from './types.js';

const typesStage = (logic: string): TParsedStage => ({
  lines: logic,
  sourceStartLine: 1,
  spec: { logic },
  type: 'plain',
});

describe('types-preamble', () => {
  it('detects types-only first stage', () => {
    const stage = typesStage('type TResult = { absent: boolean; };');

    assert.equal(isTypesPreambleStage(stage, 0), true);
    assert.equal(isTypesPreambleStage(stage, 1), false);
  });

  it('parses type declarations', () => {
    const parsed = parseTypesFromPreamble(`
      type TResult = {
        absent: boolean;
      };
      type TTopic = string;
    `);

    assert.equal(Object.keys(parsed).join(','), 'TResult,TTopic');
    assert.match(parsed.TResult ?? '', /absent: boolean/);
  });
});
