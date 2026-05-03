import type { StageTokenTrace } from "@/shared/transport";
import type { TAgentTracker } from "@/orchestrator/-utils/agent-trackers";

import { computeCost } from "@/orchestrator/pricing";

type SessionForkLineagePayload = {
  sourceRequestId: string;
  sourceSessionId: string;
  stageIndex: number;
};

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

export const createStepTracker = () => {
  const baseUrlRaw = process.env.SESSION_API_BASE_URL;
  const baseUrl = baseUrlRaw ? normalizeBaseUrl(baseUrlRaw) : "http://localhost:4000";

  const registerSession = async (
    sessionId: string,
    opts: { forkLineage?: SessionForkLineagePayload; taskYahlPath: string },
  ) => {
    if (!baseUrl) return;

    const url = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/register`;

    try {
      await fetch(url, {
        body: JSON.stringify({
          ...(opts.forkLineage ? { forkLineage: opts.forkLineage } : {}),
          taskYahlPath: opts.taskYahlPath,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
    } catch (error) {
      console.warn(`[WARN] failed to register session: ${String(error)}\n`);
    }
  };

  const patchRuntimeSnapshot = async (
    sessionId: string,
    requestId: string,
    patch: { contextAfter?: unknown; contextBefore?: unknown },
  ) => {
    if (!baseUrl) return;

    const sessionUrl = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/usage-events`;

    try {
      await fetch(sessionUrl, {
        body: JSON.stringify({
          ...patch,
          requestId,
          runtimeSnapshotPatch: true,
          sessionId,
          timestamp: new Date().toISOString(),
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
    } catch (error) {
      console.warn(`[WARN] failed to persist runtime snapshot patch: ${String(error)}\n`);
    }
  };

  const postStep = async (trace: StageTokenTrace) => {
    if (!baseUrl) return;

    const sessionUrl = `${baseUrl}/api/sessions/${encodeURIComponent(trace.sessionId)}/usage-events`;
    const payload = {
      chatMessages: trace.chatMessages,
      contextAfter: trace.contextAfter,
      contextAfterTruncated: trace.contextAfterTruncated,
      contextBefore: trace.contextBefore,
      contextBeforeTruncated: trace.contextBeforeTruncated,
      cost: computeCost(trace.model, trace.usage),
      executionMeta: trace.executionMeta,
      model: trace.model,
      requestId: trace.requestId,
      sessionId: trace.sessionId,
      stageInput: trace.stageInput,
      stageInputTruncated: trace.stageInputTruncated,
      thinkingMode: trace.thinkingMode,
      timestamp: trace.timestamp,
      usage: {
        cacheHitTokens: trace.usage.cacheHitTokens,
        cacheMissTokens: trace.usage.cacheMissTokens,
        completionTokens: trace.usage.completionTokens,
        reasoningTokens: trace.usage.reasoningTokens,
      },
    };

    try {
      await fetch(sessionUrl, {
        body: JSON.stringify(payload),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
    } catch (error) {
      console.warn(`[WARN] failed to persist session step: ${String(error)}\n`);
    }
  };

  const finalizeSession = async (sessionId: string, opts?: { result?: unknown }) => {
    if (!baseUrl) return;

    try {
      await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/finalize`, {
        body: JSON.stringify({ result: opts?.result }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
    } catch (error) {
      console.warn(`[WARN] failed to finalize session record: ${String(error)}\n`);
    }
  };

  const track: TAgentTracker["track"] = (event) => {
    void postStep(event);
  };

  const reset: TAgentTracker["reset"] = () => { };

  return {
    finalizeSession,
    patchRuntimeSnapshot,
    postStep,
    registerSession,
    reset,
    track,
  } satisfies TAgentTracker & {
    finalizeSession: (sessionId: string, opts?: { result?: unknown }) => Promise<void>;
    patchRuntimeSnapshot: (
      sessionId: string,
      requestId: string,
      patch: { contextAfter?: unknown; contextBefore?: unknown },
    ) => Promise<void>;
    postStep: (trace: StageTokenTrace) => Promise<void>;
    registerSession: (
      sessionId: string,
      opts: { forkLineage?: SessionForkLineagePayload; taskYahlPath: string },
    ) => Promise<void>;
  };
};
