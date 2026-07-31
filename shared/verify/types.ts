export type TVerifyResumeAction = 'rerun' | 'edit_answer' | 'reask' | 'follow_up';

export type TVerifyFailedCheck = {
  id: string;
  reason: string;
};

export type TVerifyStageSnapshot = {
  askUser?: Record<string, unknown>[];
  contextKeys?: string[];
  logic?: string;
  produceContextKeys?: string[];
};

export type TVerifyRequest = {
  contextSnapshot: Record<string, unknown>;
  invocationId?: string;
  minScore?: number;
  requestId: string;
  rubric?: string;
  sessionId: string;
  stageIndex: number;
  stageSnapshot?: TVerifyStageSnapshot;
  stageVersion?: number;
  verifyResume?: boolean;
};

export type TVerifyResponse = {
  askUserRef?: string;
  failedChecks?: TVerifyFailedCheck[];
  feedback: string;
  pass: boolean;
  resumeAction?: TVerifyResumeAction;
  score: number;
  unavailable?: boolean;
};

export type TRequestActivityStatus = 'failed' | 'queued' | 'running' | 'succeeded';

export type TRequestActivityRecord = {
  error?: string;
  invocationId?: string;
  kind: 'verify';
  requestId: string;
  resultData?: string;
  sessionId: string;
  startedAt: string;
  status: TRequestActivityStatus;
  unavailable?: boolean;
  updatedAt: string;
};
