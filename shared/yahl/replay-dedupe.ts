import type { TYahlLogic } from './types';

import { logicPreviewText } from './logic';

export type TReplayRowSlotInput = {
  loopMeta?: { index?: number };
  parsedStageIndex?: number;
  sourceStartLine?: number;
  stage?: { logic?: TYahlLogic };
};

export const replayRowSlotKey = (row: TReplayRowSlotInput) => {
  const loopIndex = row.loopMeta?.index ?? 'plain';

  if (row.parsedStageIndex != null) {
    return `${row.parsedStageIndex}:${loopIndex}`;
  }

  if (row.sourceStartLine != null) {
    return `${row.sourceStartLine}:${loopIndex}`;
  }

  return `${logicPreviewText(row.stage?.logic)}:${loopIndex}`;
};

export const dedupeReplayRowsByStageSlot = <T extends TReplayRowSlotInput>(rows: T[]) => {
  const seen = new Set<string>();
  const result: T[] = [];

  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]!;
    const key = replayRowSlotKey(row);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.unshift(row);
  }

  return result;
};
