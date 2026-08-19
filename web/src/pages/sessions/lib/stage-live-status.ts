import type { TResponseStageListItem } from "@project-yahl/server/modules/sessions/-api-types";

const pad2 = (value: number) => String(value).padStart(2, "0");

export const formatElapsedMs = (ms: number) => {
  const totalSeconds = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
};

export const resolveCurrentStage = (stages: TResponseStageListItem[]) => {
  if (stages.length === 0) {
    return null;
  }

  for (let index = stages.length - 1; index >= 0; index -= 1) {
    const stage = stages[index];

    if (stage && stage.status !== "finished") {
      return { index, stage };
    }
  }

  const index = stages.length - 1;
  const stage = stages[index];

  if (!stage) {
    return null;
  }

  return { index, stage };
};

const parseTime = (value: string | undefined) => {
  if (!value) {
    return Number.NaN;
  }

  return Date.parse(value);
};

const isOpenStatus = (status: TResponseStageListItem["status"]) =>
  status === "running" || status === "verifying";

export const resolveStageElapsed = (
  stage: Pick<
    TResponseStageListItem,
    | "createdAt"
    | "lastModelDurationMs"
    | "lastModelResponseAt"
    | "lastToolCallAt"
    | "modelDurationMs"
    | "status"
  >,
  nowMs: number,
) => {
  const completedMs = Math.max(0, stage.modelDurationMs);
  const createdMs = parseTime(stage.createdAt);
  const lastModelMs = parseTime(stage.lastModelResponseAt);
  const lastToolMs = parseTime(stage.lastToolCallAt);
  const callStartMs = Number.isNaN(lastModelMs)
    ? (Number.isNaN(lastToolMs) ? createdMs : lastToolMs)
    : lastToolMs;
  const inFlight = isOpenStatus(stage.status)
    && !Number.isNaN(callStartMs)
    && (Number.isNaN(lastModelMs) || callStartMs > lastModelMs);

  if (inFlight) {
    const currentMs = Math.max(0, nowMs - callStartMs);

    return {
      currentMs,
      inFlight: true,
      totalMs: completedMs + currentMs,
    };
  }

  return {
    currentMs: Math.max(0, stage.lastModelDurationMs),
    inFlight: false,
    totalMs: completedMs,
  };
};
