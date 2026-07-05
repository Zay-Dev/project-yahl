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

export type TYahlStage = {
  askUser?: TYahlAskUserEntry[];
  conditionMode?: boolean;
  contextKeys?: string[];
  contextMode?: boolean;
  logic: string;
  loopSetup?: string;
  planMode?: boolean;
  produceContextKeys?: string[];
  produceTypeKeys?: string[];
  temperature?: number;
  updateContextKeys?: string[];
  verify?: boolean;
  verifyAutoRetry?: boolean;
  verifyMinScore?: number;
  verifyResume?: boolean;
  verifyRubric?: string;
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
