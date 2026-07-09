import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TParsedStage } from '../-types';

import { resolveReplayStageMetadata } from './stage-read';

const parsedStages: TParsedStage[] = [
  {
    lines: 'types',
    sourceStartLine: 10,
    spec: { logic: 'types' },
    type: 'plain',
  },
  {
    lines: 'clarify',
    sourceStartLine: 147,
    spec: { logic: 'clarify' },
    type: 'plain',
  },
];

describe('resolveReplayStageMetadata', () => {
  it('backfills sourceStartLine from parsedStages when stage doc omits it', () => {
    const metadata = resolveReplayStageMetadata(
      { parsedStageIndex: 1, sourceStartLine: undefined },
      parsedStages,
    );

    assert.equal(metadata.parsedStageIndex, 1);
    assert.equal(metadata.sourceStartLine, 147);
  });

  it('returns undefined parsedStageIndex when stage doc omits it', () => {
    const metadata = resolveReplayStageMetadata(
      { parsedStageIndex: undefined, sourceStartLine: 1 },
      parsedStages,
    );

    assert.equal(metadata.parsedStageIndex, undefined);
    assert.equal(metadata.sourceStartLine, 1);
  });

  it('prefers parsedStages sourceStartLine over stale stage doc value', () => {
    const metadata = resolveReplayStageMetadata(
      { parsedStageIndex: 1, sourceStartLine: 1 },
      parsedStages,
    );

    assert.equal(metadata.sourceStartLine, 147);
  });
});
