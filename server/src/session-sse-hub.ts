import { EventEmitter } from "events";

export type SessionStepSsePayload = {
  cost: number;
  durationMs: number | null;
  executionMeta?: unknown;
  model: string;
  requestId: string;
  replyPreview: string | null;
  sessionId: string;
  stageInput?: unknown;
  stageInputTruncated?: boolean;
  stepIndex: number;
  usage: {
    cacheHitTokens: number;
    cacheMissTokens: number;
    completionTokens: number;
    reasoningTokens: number;
  };
};

export type SessionMetaSsePayload = {
  finalizedAt: string | null;
  sessionId: string;
  taskYahlPath: string | null;
};

export type SessionsLifecycleSsePayload = {
  eventType: "created" | "finalized" | "updated";
  finalizedAt: string | null;
  sessionId: string;
  taskYahlPath: string | null;
  updatedAt: string | null;
};

const emitters = new Map<string, EventEmitter>();
const sessionsEmitter = new EventEmitter();

sessionsEmitter.setMaxListeners(200);

const hubFor = (sessionId: string) => {
  let emitter = emitters.get(sessionId);

  if (!emitter) {
    emitter = new EventEmitter();
    emitter.setMaxListeners(200);
    emitters.set(sessionId, emitter);
  }

  return emitter;
};

export const emitSessionMeta = (sessionId: string, meta: SessionMetaSsePayload) => {
  hubFor(sessionId).emit("meta", meta);
};

export const emitSessionStep = (sessionId: string, step: SessionStepSsePayload) => {
  hubFor(sessionId).emit("step", step);
};

export const subscribeSessionSse = (
  sessionId: string,
  handlers: {
    onMeta: (meta: SessionMetaSsePayload) => void;
    onStep: (step: SessionStepSsePayload) => void;
  },
) => {
  const emitter = hubFor(sessionId);

  emitter.on("meta", handlers.onMeta);
  emitter.on("step", handlers.onStep);

  return () => {
    emitter.off("meta", handlers.onMeta);
    emitter.off("step", handlers.onStep);
  };
};

export const emitSessionsLifecycle = (payload: SessionsLifecycleSsePayload) => {
  sessionsEmitter.emit("session", payload);
};

export const subscribeSessionsSse = (
  handlers: {
    onSession: (payload: SessionsLifecycleSsePayload) => void;
  },
) => {
  sessionsEmitter.on("session", handlers.onSession);

  return () => {
    sessionsEmitter.off("session", handlers.onSession);
  };
};
