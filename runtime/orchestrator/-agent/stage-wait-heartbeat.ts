export const STAGE_WAIT_HEARTBEAT_MS = 60_000;
export const STAGE_WAIT_POLL_MS = 2_500;

export type TStageWaitHeartbeat = {
  clear: () => void;
};

export const startStageWaitHeartbeat = (opts: {
  getElapsedMs: () => number;
  intervalMs?: number;
  log?: (...args: unknown[]) => void;
  onPoll?: () => void | Promise<void>;
  pollIntervalMs?: number;
  requestId: string;
  sessionId: string;
  stageId?: string;
  stageIndex: number;
}): TStageWaitHeartbeat => {
  const intervalMs = opts.intervalMs ?? STAGE_WAIT_HEARTBEAT_MS;
  const pollIntervalMs = opts.pollIntervalMs ?? STAGE_WAIT_POLL_MS;
  const log = opts.log ?? console.log;

  const timer = setInterval(() => {
    log(
      `[yahl-diag] stage wait heartbeat requestId=${opts.requestId} elapsedMs=${opts.getElapsedMs()} `
      + `stageIndex=${opts.stageIndex} stageId=${opts.stageId ?? '-'} sessionId=${opts.sessionId}`,
    );
  }, intervalMs);

  const pollTimer = opts.onPoll
    ? setInterval(() => {
      void opts.onPoll?.();
    }, pollIntervalMs)
    : undefined;

  return {
    clear: () => {
      clearInterval(timer);

      if (pollTimer) {
        clearInterval(pollTimer);
      }
    },
  };
};
