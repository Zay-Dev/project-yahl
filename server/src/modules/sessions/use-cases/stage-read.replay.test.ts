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
  {
    lines: 'loop',
    sourceStartLine: 265,
    spec: { logic: 'loop', loopSetup: 'for each src of [study_plan.sources]' },
    type: 'loop',
  },
];

describe('resolveReplayStageMetadata', () => {
  it('backfills sourceStartLine from parsedStages when stage doc omits it', () => {
    const plainCursor = { value: 0 };

    const metadata = resolveReplayStageMetadata(
      { loopMeta: undefined, parsedStageIndex: 1, sourceStartLine: undefined },
      parsedStages,
      plainCursor,
      2,
    );

    assert.equal(metadata.parsedStageIndex, 1);
    assert.equal(metadata.sourceStartLine, 147);
  });

  it('infers parsedStageIndex for historic plain stages missing parsedStageIndex', () => {
    const plainCursor = { value: 0 };

    const first = resolveReplayStageMetadata(
      { loopMeta: undefined, parsedStageIndex: undefined, sourceStartLine: 1 },
      parsedStages,
      plainCursor,
      2,
    );
    const second = resolveReplayStageMetadata(
      { loopMeta: undefined, parsedStageIndex: undefined, sourceStartLine: 1 },
      parsedStages,
      plainCursor,
      2,
    );

    assert.equal(first.parsedStageIndex, 0);
    assert.equal(first.sourceStartLine, 10);
    assert.equal(second.parsedStageIndex, 1);
    assert.equal(second.sourceStartLine, 147);
  });

  it('prefers parsedStages sourceStartLine over stale stage doc value', () => {
    const plainCursor = { value: 0 };

    const metadata = resolveReplayStageMetadata(
      { loopMeta: undefined, parsedStageIndex: 1, sourceStartLine: 1 },
      parsedStages,
      plainCursor,
      2,
    );

    assert.equal(metadata.sourceStartLine, 147);
  });

  it('infers loop parsedStageIndex for loop iterations missing parsedStageIndex', () => {
    const plainCursor = { value: 2 };

    const metadata = resolveReplayStageMetadata(
      {
        loopMeta: { arraySnapshot: [1, 2], index: 1, value: 2 },
        parsedStageIndex: undefined,
        sourceStartLine: 1,
      },
      parsedStages,
      plainCursor,
      2,
    );

    assert.equal(metadata.parsedStageIndex, 2);
    assert.equal(metadata.sourceStartLine, 265);
  });
});
