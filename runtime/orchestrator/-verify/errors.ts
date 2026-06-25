export class VerifyFailedError extends Error {
  readonly feedback: string;
  readonly requestId: string;
  readonly score: number;
  readonly stageIndex: number;
  readonly verifyId?: string;

  constructor(params: {
    feedback: string;
    requestId: string;
    score: number;
    stageIndex: number;
    verifyId?: string;
  }) {
    super('verify failed');
    this.name = 'VerifyFailedError';
    this.feedback = params.feedback;
    this.requestId = params.requestId;
    this.score = params.score;
    this.stageIndex = params.stageIndex;
    this.verifyId = params.verifyId;
  }
}

export class VerifyUnavailableError extends Error {
  readonly feedback: string;
  readonly requestId: string;
  readonly stageIndex: number;
  readonly verifyId?: string;

  constructor(params: {
    feedback: string;
    requestId: string;
    stageIndex: number;
    verifyId?: string;
  }) {
    super('verify unavailable');
    this.name = 'VerifyUnavailableError';
    this.feedback = params.feedback;
    this.requestId = params.requestId;
    this.stageIndex = params.stageIndex;
    this.verifyId = params.verifyId;
  }
}

export class ProduceKeysFailedError extends Error {
  readonly feedback: string;
  readonly missingKeys: string[];
  readonly requestId: string;
  readonly stageIndex: number;
  readonly verifyId?: string;

  constructor(params: {
    feedback: string;
    missingKeys: string[];
    requestId: string;
    stageIndex: number;
    verifyId?: string;
  }) {
    super('produce keys failed');
    this.name = 'ProduceKeysFailedError';
    this.feedback = params.feedback;
    this.missingKeys = params.missingKeys;
    this.requestId = params.requestId;
    this.stageIndex = params.stageIndex;
    this.verifyId = params.verifyId;
  }
}
