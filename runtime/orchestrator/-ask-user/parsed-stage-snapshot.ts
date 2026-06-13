import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

export type TParsedStageSnapshot = {
  lines: string;
  sourceStartLine: number;
  type: 'loop' | 'plain';
};

export const toParsedStageSnapshot = (stage: ParsedStage): TParsedStageSnapshot => ({
  lines: stage.lines,
  sourceStartLine: stage.sourceStartLine,
  type: stage.type,
});

export const parsedStageFromSnapshot = (
  stage: ParsedStage['spec'],
  snapshot: TParsedStageSnapshot,
): ParsedStage => ({
  lines: snapshot.lines,
  sourceStartLine: snapshot.sourceStartLine,
  spec: stage,
  type: snapshot.type,
});
