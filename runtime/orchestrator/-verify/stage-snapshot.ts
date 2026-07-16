import type { TVerifyStageSnapshot } from '@/shared/mastermind-client';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { YahlStage } from '@/shared/yahl-stage';

export const toVerifyStageSnapshot = (spec: YahlStage): TVerifyStageSnapshot => ({
  ...(spec.askUser?.length ? { askUser: spec.askUser as Record<string, unknown>[] } : {}),
  ...(spec.contextKeys?.length ? { contextKeys: spec.contextKeys } : {}),
  logic: spec.logic,
  ...(spec.produceContextKeys?.length ? { produceContextKeys: spec.produceContextKeys } : {}),
});

export const resolveVerifyResumeEnabled = (spec: YahlStage) => {
  if (spec.verify?.resume === false) {
    return false;
  }

  return Boolean(spec.askUser?.length);
};

export const resolveFreshStageForVerifyResume = (
  stageIndex: number,
  yahlStages: ParsedStage[],
  checkpointStage: YahlStage,
): ParsedStage | null => {
  const fromYaml = yahlStages[stageIndex];

  if (!fromYaml) {
    return null;
  }

  return {
    ...fromYaml,
    spec: {
      ...fromYaml.spec,
      askUser: checkpointStage.askUser?.map(({ answer: _answer, ...entry }) => entry)
        ?? fromYaml.spec.askUser,
      logic: fromYaml.spec.logic,
    },
  };
};
