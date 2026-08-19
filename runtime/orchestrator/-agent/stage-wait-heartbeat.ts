export const STAGE_WAIT_HEARTBEAT_MS = 60_000;

export type TStageWaitHeartbeat = {
  clear: () => void;
};

export const startStageWaitHeartbeat = (opts: {
  getElapsedMs: () => number;
  intervalMs?: number;
  log?: (...args: unknown[]) => void;
  requestId: string;
  sessionId: string;
  stageId?: string;
  stageIndex: number;
}): TStageWaitHeartbeat => {
  const intervalMs = opts.intervalMs ?? STAGE_WAIT_HEARTBEAT_MS;
  const log = opts.log ?? console.log;

  const timer = setInterval(() => {
    log(
      `[yahl-diag] stage wait heartbeat requestId=${opts.requestId} elapsedMs=${opts.getElapsedMs()} `
      + `stageIndex=${opts.stageIndex} stageId=${opts.stageId ?? '-'} sessionId=${opts.sessionId}`,
    );
  }, intervalMs);

  return {
    clear: () => clearInterval(timer),
  };
};
