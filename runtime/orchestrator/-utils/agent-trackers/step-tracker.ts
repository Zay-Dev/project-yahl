import type { StageTokenTrace } from "@/shared/transport";
import type { TAgentTracker } from "@/orchestrator/-utils/agent-trackers";

import { computeCost } from "@/orchestrator/pricing";

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

export const createStepTracker = () => {
  const baseUrlRaw = process.env.SESSION_API_BASE_URL;
  const baseUrl = baseUrlRaw ? normalizeBaseUrl(baseUrlRaw) : "http://localhost:4000";

  const registerSession = async (sessionId: string, opts: { taskYahlPath: string }) => {
    if (!baseUrl) return;

    const url = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/register`;

    try {
      await fetch(url, {
        body: JSON.stringify({ taskYahlPath: opts.taskYahlPath }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
    } catch (error) {
      process.stderr.write(`[WARN] failed to register session: ${String(error)}\n`);
    }
  };

  const postStep = async (trace: StageTokenTrace) => {
    if (!baseUrl) return;

    const sessionUrl = `${baseUrl}/api/sessions/${encodeURIComponent(trace.sessionId)}/usage-events`;
    const payload = {
      cost: computeCost(trace.model, trace.usage),
      executionMeta: trace.executionMeta,
      model: trace.model,
      requestId: trace.requestId,
      response: trace.response,
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
      process.stderr.write(`[WARN] failed to persist session step: ${String(error)}\n`);
    }
  };

  const finalizeSession = async (sessionId: string) => {
    if (!baseUrl) return;

    try {
      await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/finalize`, {
        method: "POST",
      });
    } catch (error) {
      process.stderr.write(`[WARN] failed to finalize session record: ${String(error)}\n`);
    }
  };

  const track: TAgentTracker["track"] = (event) => {
    void postStep(event);
  };

  const reset: TAgentTracker["reset"] = () => { };

  return {
    finalizeSession,
    postStep,
    registerSession,
    reset,
    track,
  } satisfies TAgentTracker & {
    finalizeSession: (sessionId: string) => Promise<void>;
    postStep: (trace: StageTokenTrace) => Promise<void>;
    registerSession: (sessionId: string, opts: { taskYahlPath: string }) => Promise<void>;
  };
};
