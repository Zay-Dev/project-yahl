import { randomUUID } from 'crypto';

import type { TResponseStageReplayItem } from '../-api-types';
import { modelStage } from '../models';

export const copyPrefixStagesToSession = async (
  targetSessionRef: string,
  prefixRows: TResponseStageReplayItem[],
  finishedAt: Date,
) => {
  if (!prefixRows.length) {
    return;
  }

  await modelStage.insertMany(
    prefixRows.map((row) => ({
      context: row.context ?? {},
      contextAfter: row.contextAfter,
      finishedAt,
      loopMeta: row.loopMeta,
      ...(row.parsedStageIndex === undefined ? {} : { parsedStageIndex: row.parsedStageIndex }),
      requestId: randomUUID(),
      ...(row.sourceStartLine === undefined ? {} : { sourceStartLine: row.sourceStartLine }),
      session: targetSessionRef,
      stage: row.stage,
      ...(row.temperature === undefined ? {} : { temperature: row.temperature }),
      ...(row.verifyResult ? { verifyResult: row.verifyResult } : {}),
    })),
  );
};
