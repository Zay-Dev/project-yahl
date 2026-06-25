export type TRequestActivityStatus = 'failed' | 'queued' | 'running' | 'succeeded';

export type TRequestActivityKind = 'skill' | 'verify';

export type TRequestActivityRecord = {
  error?: string;
  invocationId?: string;
  kind: TRequestActivityKind;
  requestId: string;
  resultData?: string;
  sessionId: string;
  skill?: string;
  startedAt: string;
  status: TRequestActivityStatus;
  unavailable?: boolean;
  updatedAt: string;
};

export type TRequestStatusResponse = {
  agent?: string;
  error?: string;
  ok: boolean;
  queueDepth?: number;
  request?: TRequestActivityRecord | null;
  unavailable?: boolean;
};

export type TActivityWatch = {
  invocationId: string;
  requestId: string;
  sessionId: string;
};

export type TActivityErrorPrefix = 'mastermind' | 'worker';
