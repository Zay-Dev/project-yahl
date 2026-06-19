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
