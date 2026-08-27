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

export type TYahlWhileSetupSpec = {
  condition: string;
  doAtLeast?: number;
};

export type TYahlWhileSetup = string | TYahlWhileSetupSpec;

export type TYahlLogicRef = {
  $ref: string;
};

export type TYahlFragment = {
  stages: TYahlStage[];
  types?: string;
};

export type TYahlLogic = string | TYahlFragment | TYahlLogicRef;

export type TStageAgentMeta = {
  isMainThread: boolean;
  nestedIndex?: number;
  nestedPath?: string;
  parallelGroupId?: string;
  parallelSlot?: number;
  parentRequestId?: string;
};

export type TYahlStage = {
  agentOverrides?: TYahlAgentOverrides;
  askUser?: TYahlAskUserEntry[];
  cacheMaxAge?: number;
  conditionMode?: boolean;
  contextKeys?: string[];
  contextMode?: boolean;
  goto?: TYahlGotoEntry[];
  id?: string;
  knowledgeToScript?: boolean;
  logic: TYahlLogic;
  loopSetup?: string;
  mainThread?: boolean;
  maxBashCalls?: number;
  warmUp?: string;
  whileSetup?: TYahlWhileSetup;
  maxTurns?: number;
  nixeryInput?: TNixeryStageInput;
  nixeryRun?: string;
  parallelAfter?: string[];
  parallelGroup?: string;
  produceContextKeys?: string[];
  produceTypeKeys?: string[];
  stagehand?: TYahlStagehandConfig;
  temperature?: number;
  updateContextKeys?: string[];
  verify?: TYahlVerifySpec;
  version?: number;
};

export type TStageLoopMetaKind = 'warmup' | 'for' | 'while';

export type TStageLoopMeta = {
  arraySnapshot?: unknown[];
  endAfter?: number;
  index?: number;
  indexName?: string;
  kind?: TStageLoopMetaKind;
  remainingBashCalls?: number;
  remainingTurns?: number;
  startAt?: number;
  step?: number;
  temperature?: number;
  value?: unknown;
};

export type TParsedStage = {
  contextKeys?: string[];
  lines: string;
  nestedStages?: TParsedStage[];
  produceContextKeys?: string[];
  produceTypeKeys?: string[];
  sourceStartLine: number;
  spec: TYahlStage;
  temperature?: number;
  type: 'loop' | 'plain' | 'while';
  updateContextKeys?: string[];
};

export type TSessionRunCursor = {
  kind: 'pipeline' | 'repair';
  loopMeta?: TStageLoopMeta;
  nestedIndex?: number;
  repairInstruction?: string;
  stageIndex: number;
};
