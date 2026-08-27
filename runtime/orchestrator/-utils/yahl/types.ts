import type { YahlStage } from "@/shared/yahl-stage";

import type { TParsedStage, TStageLoopMeta } from "@project-yahl/shared/yahl/types";

export type StageLoopMeta = TStageLoopMeta & {
  arraySnapshot: unknown[];
  index: number;
  value: unknown;
};

export type ParsedStage = TParsedStage & {
  spec: YahlStage;
};

export interface ComposeUpOptions {
  composeOverrideFilePaths?: string[];
  composeProjectName: string;
}

export interface ComposeDownOptions {
  composeOverrideFilePaths?: string[];
  composeProjectName: string;
  sessionId?: string;
}
