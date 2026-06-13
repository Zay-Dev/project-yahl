import type { TStorage } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/orchestrator-types';
import type { YahlStage } from '@/shared/yahl-stage';

type TStageLoopMeta = {
  arraySnapshot: unknown[];
  endAfter?: number;
  index: number;
  indexName?: string;
  startAt?: number;
  step?: number;
  temperature?: number;
  value: unknown;
};

import { storageFromSnapshot } from './storage-context';

export type TReplayStageRow = {
  context: Record<string, unknown>;
  contextAfter?: Record<string, unknown>;
  loopMeta?: TStageLoopMeta;
  requestId: string;
  stage: YahlStage;
  stageId: string;
  temperature?: number;
};

export type TForkSessionSetup = {
  context: Record<string, unknown>;
  loopMeta?: TStageLoopMeta;
  stage: YahlStage;
  stageId: string;
};

export type TForkSessionResponse = {
  anchorStageId: string;
  forkSessionId: string;
  parsedStages?: ParsedStage[];
  resultContextKey?: string;
  setups: TForkSessionSetup[];
  sourceSessionId: string;
  targetSessionId: string;
  taskYahlPath?: string;
};

export type TForkFastForwardStep = { kind: 'fastForward'; row: TReplayStageRow };
export type TForkRunStep = { kind: 'run'; setup: TForkSessionSetup };
export type TForkExecutionStep = TForkFastForwardStep | TForkRunStep;

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const resolveBaseUrl = () => normalizeBaseUrl(process.env.SESSION_API_BASE_URL || 'http://localhost:4000');

const fetchForkSession = async (forkSessionId: string) => {
  const baseUrl = resolveBaseUrl();
  const url = `${baseUrl}/api/fork-sessions/${encodeURIComponent(forkSessionId)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch fork session: ${response.status}`);
  }

  return await response.json() as TForkSessionResponse;
};

const fetchSourceReplay = async (sourceSessionId: string) => {
  const baseUrl = resolveBaseUrl();
  const url = `${baseUrl}/api/sessions/${encodeURIComponent(sourceSessionId)}/stages/replay`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch source replay stages: ${response.status}`);
  }

  const payload = await response.json() as unknown;

  if (Array.isArray(payload)) {
    return payload as TReplayStageRow[];
  }

  if (payload && typeof payload === 'object') {
    const record = payload as { data?: unknown; items?: unknown };

    if (Array.isArray(record.data)) {
      return record.data as TReplayStageRow[];
    }

    if (Array.isArray(record.items)) {
      return record.items as TReplayStageRow[];
    }
  }

  return [];
};

export class ForkSessionManager {
  constructor(
    readonly forkSession: TForkSessionResponse,
    readonly sourceRows: TReplayStageRow[],
  ) {}

  get targetSessionId() {
    return this.forkSession.targetSessionId;
  }

  get sourceSessionId() {
    return this.forkSession.sourceSessionId;
  }

  get resultContextKey() {
    return this.forkSession.resultContextKey;
  }

  get taskYahlPath() {
    return this.forkSession.taskYahlPath ?? '';
  }

  get parsedStages() {
    return this.forkSession.parsedStages ?? [];
  }

  getAnchorIndex() {
    const anchorIndex = this.sourceRows.findIndex(
      (row) => row.stageId === this.forkSession.anchorStageId,
    );

    if (anchorIndex < 0) {
      throw new Error(`Anchor stage ${this.forkSession.anchorStageId} not found in source replay`);
    }

    return anchorIndex;
  }

  getPrefixRows() {
    return this.sourceRows.slice(0, this.getAnchorIndex());
  }

  getSuffixSetups() {
    return this.forkSession.setups;
  }

  buildExecutionPlan(): TForkExecutionStep[] {
    const anchorIndex = this.getAnchorIndex();
    const plan: TForkExecutionStep[] = [];

    for (let index = 0; index < anchorIndex; index += 1) {
      const row = this.sourceRows[index]!;

      plan.push({ kind: 'fastForward', row });
    }

    for (const setup of this.forkSession.setups) {
      plan.push({ kind: 'run', setup });
    }

    return plan;
  }

  contextAfterForPrefixRow(row: TReplayStageRow): TStorage | undefined {
    return storageFromSnapshot(row.contextAfter);
  }
}

export const initForkSessionManager = async (forkSessionId: string) => {
  if (!forkSessionId.trim()) {
    throw new Error('Missing fork session id');
  }

  const forkSession = await fetchForkSession(forkSessionId);
  const sourceRows = await fetchSourceReplay(forkSession.sourceSessionId);

  if (sourceRows.length === 0) {
    throw new Error(
      `No replay stages for source session ${forkSession.sourceSessionId} `
      + `(SESSION_API_BASE_URL=${resolveBaseUrl()})`,
    );
  }

  const manager = new ForkSessionManager(forkSession, sourceRows);

  manager.getAnchorIndex();

  return manager;
};
