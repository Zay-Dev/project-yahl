import type { TSoftDeletable, TWithTimestamps } from '@omni-infra/types/entities';

import type { TTaskSkillFile } from '@project-yahl/shared/yahl/task-skills';
import type { TYahlVerifySpec } from '@project-yahl/shared/yahl/verify';

export type { TYahlVerifySpec } from '@project-yahl/shared/yahl/verify';

export type TTokenTotals = {
  cacheHitTokens: number;
  cacheMissTokens: number;
  completionTokens: number;
  promptTokens: number;
  reasoningTokens: number;
  totalTokens: number;
};

export type TStageLoopMeta = {
  arraySnapshot: unknown[];
  endAfter?: number;
  index: number;
  indexName?: string;
  startAt?: number;
  step?: number;
  temperature?: number;
  value: unknown;
};

export type TYahlAskUserOption = {
  description?: string;
  id: string;
  label: string;
};

export type TYahlAskUserEntry = {
  answer?: number | string | string[];
  id: string;
  options?: TYahlAskUserOption[];
  question: string;
};

export type TNixeryStageInput = Record<string, string | number | boolean>;

export type TYahlAgentOverrides = {
  bashTimeoutMs?: number;
};

export type TYahlGotoEntry = {
  command: string;
  description: string;
};

export type TYahlStage = {
  agentOverrides?: TYahlAgentOverrides;
  askUser?: TYahlAskUserEntry[];
  conditionMode?: boolean;
  contextKeys?: string[];
  contextMode?: boolean;
  goto?: TYahlGotoEntry[];
  id?: string;
  logic: string;
  loopSetup?: string;
  maxBashCalls?: number;
  maxTurns?: number;
  nixeryInput?: TNixeryStageInput;
  nixeryRun?: string;
  produceContextKeys?: string[];
  produceTypeKeys?: string[];
  temperature?: number;
  updateContextKeys?: string[];
  verify?: TYahlVerifySpec;
  version?: number;
};

export type TParsedStage = {
  contextKeys?: string[];
  lines: string;
  produceContextKeys?: string[];
  produceTypeKeys?: string[];
  sourceStartLine: number;
  spec: TYahlStage;
  temperature?: number;
  type: 'loop' | 'plain';
  updateContextKeys?: string[];
};

export type TSessionForkedFrom = {
  anchorStageId: string;
  forkSessionId: string;
  sourceSessionId: string;
};

export type TSessionRunCursor = {
  kind: 'pipeline';
  loopMeta?: TStageLoopMeta;
  stageIndex: number;
};

export type TForkSessionStageSetup = {
  context: Record<string, unknown>;
  loopMeta?: TStageLoopMeta;
  stage: TYahlStage;
  stageId: string;
};

export interface IForkSession extends TWithTimestamps {
  _id: string;
  anchorStageId: string;
  forkSessionId: string;
  setups: TForkSessionStageSetup[];
  sourceSessionId: string;
  targetSessionId: string;
}

export interface ISession extends TSoftDeletable, TWithTimestamps {
  _id: string;
  forkedFrom?: TSessionForkedFrom;
  isBackground?: boolean;
  liveViewVncPort?: number | null;
  parsedStages?: TParsedStage[];
  resultContextKey?: string;
  runCursor?: TSessionRunCursor;
  runInput?: Record<string, unknown>;
  sessionId: string;
  result?: unknown;
  storageSeed?: Record<string, unknown>;
  taskId?: string;
  taskSkills?: TTaskSkillFile[];
  taskYahl?: string;
}

export interface IStage extends TWithTimestamps {
  _id: string;
  session: string;
  requestId: string;
  context: Record<string, unknown>;
  contextAfter?: Record<string, unknown>;
  finishedAt?: Date;
  parsedStageIndex?: number;
  sourceStartLine?: number;
  stage: TYahlStage;
  loopMeta?: TStageLoopMeta;
  temperature?: number;
  verifyingAt?: Date;
  verifyResult?: {
    feedback: string;
    pass: boolean;
    score: number;
  };
}

export type TModelResponseTag =
  | 'browse'
  | 'stagehand'
  | 'bash'
  | 'chat'
  | 'tool'
  | 'unknown'
  | `mastermind:${string}`;

export interface IModelResponse extends TWithTimestamps {
  _id: string;
  session: string;
  requestId: string;
  durationMs?: number;
  response: Record<string, unknown>;
  tags?: TModelResponseTag[];
  thinkingMode?: boolean;
}

export interface IToolCall extends TWithTimestamps {
  _id: string;
  session: string;
  requestId: string;
  toolCalls: Record<string, unknown>[];
}

export type TAskUserQuestionStatus = 'answered' | 'pending';

export type TParsedStageSnapshot = {
  lines: string;
  sourceStartLine: number;
  type: 'loop' | 'plain';
};

export type TAskUserBatchAnswerRecord = {
  answerValue: number | string | string[];
  freeText?: string;
  optionIds?: string[];
  questionRef: string;
};

export interface IAskUserQuestion extends TWithTimestamps {
  _id: string;
  batch?: Record<string, unknown>;
  batchAnswers?: TAskUserBatchAnswerRecord[];
  batchId?: string;
  contextSnapshot: Record<string, unknown>;
  forkSetupIndex?: number;
  loopMeta?: TStageLoopMeta;
  parsedStageSnapshot?: TParsedStageSnapshot;
  questionId: string;
  requestId: string;
  session: string;
  stage: TYahlStage;
  stageIndex?: number;
  status: TAskUserQuestionStatus;
  storageSnapshot: Record<string, unknown>;
  toolCallId: string;
}

export type TVerifyCheckpointKind = 'produce_keys' | 'verify';

export type TVerifyCheckpointStatus = 'pending' | 'resumed' | 'superseded';

export type TVerifyResumeAction = 'edit_answer' | 'follow_up' | 'reask' | 'rerun';

export interface IVerifyCheckpoint extends TWithTimestamps {
  _id: string;
  askUserQuestion?: Record<string, unknown>;
  askUserRef?: string;
  contextSnapshot: Record<string, unknown>;
  editedAnswerFreeText?: string;
  editedAnswerOptionIds?: string[];
  feedback: string;
  forkSetupIndex?: number;
  kind?: TVerifyCheckpointKind;
  loopMeta?: TStageLoopMeta;
  parsedStageSnapshot?: TParsedStageSnapshot;
  requestId: string;
  resumeAction?: TVerifyResumeAction;
  score: number;
  session: string;
  stage: TYahlStage;
  stageIndex?: number;
  status: TVerifyCheckpointStatus;
  storageSnapshot: Record<string, unknown>;
  unavailable?: boolean;
  verifyId: string;
}
