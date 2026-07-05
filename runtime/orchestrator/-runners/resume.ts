import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { YahlStage } from '@/shared/yahl-stage';

import { fetchAskUserCheckpoint } from '@/orchestrator/-ask-user';
import { compileStage } from '@/orchestrator/-utils/yahl';

export const resolveResumeStartIndex = (
  checkpoint: Pick<
    Awaited<ReturnType<typeof fetchAskUserCheckpoint>>,
    'parsedStageSnapshot' | 'stageIndex'
  >,
  yahlStages: ParsedStage[],
) => {
  if (checkpoint.stageIndex != null) {
    return checkpoint.stageIndex;
  }

  if (checkpoint.parsedStageSnapshot) {
    const match = yahlStages.findIndex((stage) =>
      stage.sourceStartLine === checkpoint.parsedStageSnapshot?.sourceStartLine
      && stage.lines === checkpoint.parsedStageSnapshot?.lines);

    if (match >= 0) {
      return match;
    }
  }

  throw new Error('resume: missing stageIndex for non-fork resume');
};

export const buildResumePipelineStages = (
  startIndex: number,
  yahlStages: ParsedStage[],
  resumedStage: ParsedStage,
) => [
  resumedStage,
  ...yahlStages.slice(startIndex + 1),
];

export const buildResumedStage = (
  parsedStage: ParsedStage,
  patchedStage: YahlStage,
) => compileStage(patchedStage, parsedStage.sourceStartLine);
