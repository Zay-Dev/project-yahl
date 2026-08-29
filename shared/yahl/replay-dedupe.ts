import type { TYahlLogic } from './types';

import { logicPreviewText } from './logic';

export type TReplayRowSlotInput = {
  agentMeta?: {
    nestedIndex?: number;
    nestedPath?: string;
  };
  loopMeta?: {
    index?: number;
    kind?: string;
  };
  parsedStageIndex?: number;
  sourceStartLine?: number;
  stage?: { logic?: TYahlLogic };
};

export const replayRowSlotKey = (row: TReplayRowSlotInput) => {
  const loopKind = row.loopMeta?.kind ?? 'plain';
  const loopIndex = row.loopMeta?.index ?? 'plain';
  const nested = row.agentMeta?.nestedIndex != null
    ? `n${row.agentMeta.nestedIndex}`
    : row.agentMeta?.nestedPath
      ? `p${row.agentMeta.nestedPath}`
      : 'root';

  if (row.parsedStageIndex != null) {
    return `${row.parsedStageIndex}:${loopKind}:${loopIndex}:${nested}`;
  }

  if (row.sourceStartLine != null) {
    return `${row.sourceStartLine}:${loopKind}:${loopIndex}:${nested}`;
  }

  return `${logicPreviewText(row.stage?.logic)}:${loopKind}:${loopIndex}:${nested}`;
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
