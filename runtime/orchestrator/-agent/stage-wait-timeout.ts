export const DEFAULT_STAGE_WAIT_MAX_MS = 10_800_000;

export class StageWaitTimeoutError extends Error {
  readonly maxMs: number;
  readonly requestId: string;

  constructor(requestId: string, maxMs: number) {
    super(`stage wait timed out after ${maxMs}ms requestId=${requestId}`);
    this.name = 'StageWaitTimeoutError';
    this.maxMs = maxMs;
    this.requestId = requestId;
  }
}

export const resolveStageWaitMaxMs = (env: NodeJS.ProcessEnv = process.env) => {
  const raw = env.YAHL_STAGE_WAIT_MAX_MS?.trim();

  if (raw === '0') {
    return null;
  }

  if (raw) {
    const parsed = Number(raw);

    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return DEFAULT_STAGE_WAIT_MAX_MS;
};
