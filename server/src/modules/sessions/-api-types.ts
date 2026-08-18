import type { TTaskSkillFile } from '@project-yahl/shared/yahl/task-skills';

import type { TSessionRunState } from './-session-run-state-signals';

import type {
  TForkSessionStageSetup,
  TModelResponseTag,
  TParsedStage,
  TSessionForkedFrom,
  TSessionRunCursor,
  TStageLoopMeta,
  TTokenTotals,
  TYahlStage,
} from './-types';

export type TResponseTokenTotals = TTokenTotals;

export type TResponseModelUsageByModel = {
  domains: string[];
  model: string;
  tokenTotals: TResponseTokenTotals | null;
};

export type TResponseModelUsageSummary = {
  byModel: TResponseModelUsageByModel[];
  domains: string[];
  tokenTotals: TResponseTokenTotals | null;
};

export type TResponseNixeryUsageGroup = TResponseModelUsageSummary & {
  defId: string;
};

export type TResponseGetSession = {
  _id: string;
  createdAt: string;
  deletedAt?: string;
  forkedFrom?: TSessionForkedFrom;
  isBackground?: boolean;
  liveViewVncPort?: number | null;
  parsedStages: TParsedStage[];
  result?: unknown;
  resultContextKey?: string;
  runInput: Record<string, unknown>;
  runState: TSessionRunState;
  runCursor?: TSessionRunCursor;
  sessionId: string;
  storageSeed?: Record<string, unknown>;
  taskId: string;
  taskSkills: TTaskSkillFile[];
  taskYahl: string;
  byModel: TResponseModelUsageByModel[];
  domains: string[];
  lastModelResponseAt?: string;
  nixeryUsage: TResponseNixeryUsageGroup[];
  stageUsage: TResponseModelUsageSummary;
  tokenTotals: TResponseTokenTotals | null;
  updatedAt: string;
};

export type { TSessionRunState };

export type TResponseSessionListItem = {
  _id: string;
  createdAt: string;
  deletedAt?: string;
  isBackground?: boolean;
  sessionId: string;
  taskId?: string;
  domains: string[];
  tokenTotals: TResponseTokenTotals | null;
  updatedAt: string;
};

export type TResponseStageStatus = 'finished' | 'running' | 'verifying';

export type TResponseStageListItem = {
  createdAt: string;
  finishedAt?: string;
  isTypesPreamble?: boolean;
  lastModelDurationMs: number;
  lastModelResponseAt?: string;
  lastToolCallAt?: string;
  logicPreview: string;
  loopSetup?: string;
  loopIndex?: number;
  loopValue?: unknown;
  modelCallCount: number;
  modelDurationMs: number;
  parsedStageIndex?: number;
  requestId: string;
  stageId: string;
  status: TResponseStageStatus;
  byModel: TResponseModelUsageByModel[];
  domains: string[];
  tokenTotals: TTokenTotals | null;
  toolCallCount: number;
  updatedAt: string;
};

export type TResponseStageReplayVerifyResult = {
  feedback: string;
  pass: boolean;
  score: number;
};

export type TResponseStageReplayItem = {
  context: Record<string, unknown>;
  contextAfter?: Record<string, unknown>;
  finishedAt?: string;
  loopMeta?: TStageLoopMeta;
  parsedStageIndex?: number;
  requestId: string;
  sourceStartLine?: number;
  stage: TYahlStage;
  stageId: string;
  temperature?: number;
  verifyResult?: TResponseStageReplayVerifyResult;
};

export type TResponseStageModelResponseItem = {
  _id: string;
  contentPreview: string;
  createdAt: string;
  domain?: string;
  durationMs?: number;
  model?: string;
  response?: Record<string, unknown>;
  tags?: TModelResponseTag[];
  thinkingMode?: boolean;
  usage: TTokenTotals | null;
};

export type TResponseStageToolSummary = {
  arguments: unknown;
  id: string;
  name: string;
};

export type TResponseStageToolCallItem = {
  _id: string;
  createdAt: string;
  tools: TResponseStageToolSummary[];
};

export type TResponseStageDetail = TResponseStageListItem & {
  context: Record<string, unknown>;
  contextAfter?: Record<string, unknown>;
  loopMeta?: TStageLoopMeta;
  modelResponses: TResponseStageModelResponseItem[];
  stage: TYahlStage;
  toolCalls: TResponseStageToolCallItem[];
};

export type TResponseAskUserQuestionListItem = {
  batch?: {
    batchId?: string;
    description?: string;
    questions?: {
      allowMultiple?: boolean;
      description?: string;
      kind: 'multipleChoice' | 'text';
      minChoices?: number;
      options?: { id: string; label: string }[];
      placeholder?: string;
      questionRef: string;
      title: string;
    }[];
    title?: string;
  };
  batchId?: string;
  questionCount?: number;
  questionId: string;
  requestId: string;
  status: 'answered' | 'pending';
  title?: string;
};

export type TResponsePendingAskUserQuestion = TResponseAskUserQuestionListItem & {
  sessionId: string;
  taskId?: string;
};

export type TResponseAskUserQuestionDetail = {
  batch?: TResponseAskUserQuestionListItem['batch'];
  batchId?: string;
  questionId: string;
  requestId: string;
  status: 'answered' | 'pending';
};

export type TVerifyResumeAction = 'edit_answer' | 'follow_up' | 'reask' | 'rerun';

export type TResponseVerifyCheckpoint = {
  askUserQuestion?: Record<string, unknown>;
  askUserRef?: string;
  editedAnswerFreeText?: string;
  editedAnswerOptionIds?: string[];
  feedback: string;
  kind: 'produce_keys' | 'verify';
  parsedStageSnapshot?: {
    lines: string;
    sourceStartLine: number;
    type: 'loop' | 'plain';
  };
  requestId: string;
  resumeAction?: TVerifyResumeAction;
  score: number;
  stage: TYahlStage;
  stageIndex?: number;
  status: 'pending' | 'resumed' | 'superseded';
  storageSnapshot: Record<string, unknown>;
  unavailable?: boolean;
  verifyId: string;
};

export type TSessionLiveEvent =
  | { type: 'ask-user.answered'; questionId: string; requestId: string }
  | { type: 'ask-user.created'; questionId: string; requestId: string }
  | { type: 'session.updated' }
  | { type: 'stage.created'; requestId: string }
  | { type: 'stage.finished'; requestId: string }
  | { type: 'stage.verifying'; requestId: string }
  | { type: 'stage.model-response'; requestId: string }
  | { type: 'stage.tool-call'; requestId: string }
  | { type: 'produce_keys.failed'; requestId: string; verifyId: string }
  | { type: 'produce_keys.resumed'; requestId: string; verifyId: string }
  | { type: 'verify.failed'; requestId: string; verifyId: string }
  | { type: 'verify.passed'; requestId: string }
  | { type: 'verify.resumed'; requestId: string; verifyId: string };

export type TStageListSource = {
  contextAfter?: Record<string, unknown>;
  context?: Record<string, unknown>;
  createdAt: Date | string;
  finishedAt?: Date | string;
  loopMeta?: TStageLoopMeta;
  parsedStageIndex?: number;
  requestId: string;
  stage: TYahlStage;
  temperature?: number;
  updatedAt: Date | string;
  verifyingAt?: Date | string;
};

export type TResponseGetForkSession = {
  anchorStageId: string;
  forkSessionId: string;
  parsedStages?: TParsedStage[];
  resultContextKey?: string;
  setups: TForkSessionStageSetup[];
  sourceSessionId: string;
  targetSessionId: string;
};

export type TRequestCreateForkSessionBody = {
  anchorStageId: string;
  setups: TForkSessionStageSetup[];
};

export type TResponseCreateForkSession = {
  forkSessionId: string;
  targetSessionId: string;
};

export type TResponseDeleteSession = {
  ok: true;
};
