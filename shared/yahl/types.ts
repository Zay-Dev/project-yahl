import type { TYahlVerifySpec } from './verify';

export type { TYahlVerifySpec } from './verify';
export { DEFAULT_VERIFY_DEF_ID } from './verify';

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

export type TYahlStagehandConfig = {
  apiBaseUrl?: string;
  model?: string;
  preferScreenshot?: boolean;
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
  stagehand?: TYahlStagehandConfig;
  temperature?: number;
  updateContextKeys?: string[];
  verify?: TYahlVerifySpec;
  version?: number;
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

export type TSessionRunCursor = {
  kind: 'pipeline';
  loopMeta?: TStageLoopMeta;
  stageIndex: number;
};
