import type { StageTokenTrace } from "../shared/transport";

import { computeCost } from "./pricing";

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

export const createSessionRecorder = () => {
  const baseUrlRaw = process.env.SESSION_API_BASE_URL;
  const baseUrl = baseUrlRaw ? normalizeBaseUrl(baseUrlRaw) : "";

  const postUsageEvent = async (trace: StageTokenTrace) => {
    if (!baseUrl) return;

    const sessionUrl = `${baseUrl}/api/sessions/${encodeURIComponent(trace.sessionId)}/usage-events`;
    const payload = {
      cost: computeCost(trace.model, trace.usage),
      executionMeta: {
        sourceStartLine: trace.executionMeta.sourceRef.line,
        stageIndex: trace.executionMeta.runtimeRef.generatedLine,
      },
      model: trace.model,
      requestId: trace.requestId,
      response: trace.response,
      sessionId: trace.sessionId,
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
      process.stderr.write(`[WARN] failed to persist session usage event: ${String(error)}\n`);
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

  return {
    finalizeSession,
    postUsageEvent,
  };
};
