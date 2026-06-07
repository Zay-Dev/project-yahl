import type { ParsedStage } from './orchestrator-types';
import type { YahlStage } from '@/shared/yahl-stage';

type ForkOverride = {
  context?: {
    context?: Record<string, unknown>;
    stage?: Record<string, unknown>;
    types?: Record<string, unknown>;
  };
  stage?: YahlStage;
};

declare global {
  // Legacy execute.ts / main.ts fork hook (unused by index.ts path).
  var forkRunManager: undefined | {
    getContextAfter: (stageIndex: number, iterationIndex?: number) => unknown;
    getOverride: (stageIndex: number, iterationIndex?: number) => ForkOverride | undefined;
    isFastForward: (stageIndex: number, iterationIndex?: number) => boolean;
    parsedStages: ParsedStage[];
    reportPath: string;
  };
}

export {};
