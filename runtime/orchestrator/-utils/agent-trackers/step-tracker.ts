import type { TAgentTracker } from "@/orchestrator/-utils/agent-trackers";

import { computeCost } from "@/orchestrator/pricing";

type SessionForkLineagePayload = {
  sourceRequestId: string;
  sourceSessionId: string;
  stageIndex: number;
};

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

const _post = async (url: string, body: unknown) => {
  try {
    await fetch(url, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
  } catch (error) {
    console.warn(`[WARN] failed POST ${url}: ${String(error)}\n`);
  }
};

const _patch = async (url: string, body: unknown) => {
  try {
    await fetch(url, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
  } catch (error) {
    console.warn(`[WARN] failed PATCH ${url}: ${String(error)}\n`);
  }
};

export const createStepTracker = () => {
  const baseUrlRaw = process.env.SESSION_API_BASE_URL;
  const baseUrl = baseUrlRaw ? normalizeBaseUrl(baseUrlRaw) : "http://localhost:4000";

  let queue: Promise<void> = Promise.resolve();

  const enqueue = (fn: () => Promise<void>) => {
    queue = queue
      .then(fn)
      .catch((error: unknown) => {
        console.warn(`[WARN] step-tracker queue error: ${String(error)}\n`);
      });
    return queue;
  };

  const registerSession = async (
    sessionId: string,
    opts: { forkLineage?: SessionForkLineagePayload; taskYahlPath: string },
  ) => {
    if (!baseUrl) return;

    const url = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/register`;

    await _post(url, {
      ...(opts.forkLineage ? { forkLineage: opts.forkLineage } : {}),
      taskYahlPath: opts.taskYahlPath,
    });
  };

  const pushRequest: TAgentTracker["pushRequest"] = (event) =>
    enqueue(async () => {
      if (!baseUrl) return;

      const url = `${baseUrl}/api/sessions/${encodeURIComponent(event.sessionId)}/stages`;

      await _post(url, {
        contextBefore: event.contextBefore,
        currentStage: event.currentStage,
        executionMeta: event.executionMeta,
        requestId: event.requestId,
        stageId: event.executionMeta.stageId,
        timestamp: event.timestamp,
      });
    });

  const toolCall: TAgentTracker["toolCall"] = (event) =>
    enqueue(async () => {
      if (!baseUrl) return;
      if (!event.toolCalls.length) return;

      const url = `${baseUrl}/api/sessions/${encodeURIComponent(event.sessionId)}` +
        `/stages/${encodeURIComponent(event.stageId)}/tool-calls`;

      await _post(url, {
        requestId: event.requestId,
        timestamp: event.timestamp,
        toolCalls: event.toolCalls,
      });
    });

  const modelResponse: TAgentTracker["modelResponse"] = (event) =>
    enqueue(async () => {
      if (!baseUrl) return;

      const url = `${baseUrl}/api/sessions/${encodeURIComponent(event.sessionId)}` +
        `/stages/${encodeURIComponent(event.stageId)}/model-responses`;

      const message = event.response.choices?.[0]?.message;
      const reply = typeof message?.content === "string" ? message.content : null;
      const toolCalls = message?.tool_calls;
      const chatMessages = event.response.choices?.map(({ message: m }) => m);

      await _post(url, {
        chatMessages,
        cost: computeCost(event.model, event.usage),
        durationMs: event.durationMs,
        model: event.model,
        requestId: event.requestId,
        response: {
          durationMs: event.durationMs,
          reasoning: null,
          reply,
          toolCalls,
        },
        thinkingMode: event.thinkingMode,
        timestamp: event.timestamp,
        usage: {
          cacheHitTokens: event.usage.cacheHitTokens,
          cacheMissTokens: event.usage.cacheMissTokens,
          completionTokens: event.usage.completionTokens,
          reasoningTokens: event.usage.reasoningTokens,
        },
      });
    });

  const stageFinish: TAgentTracker["stageFinish"] = (event) =>
    enqueue(async () => {
      if (!baseUrl) return;

      const url = `${baseUrl}/api/sessions/${encodeURIComponent(event.sessionId)}` +
        `/stages/${encodeURIComponent(event.stageId)}/runtime-snapshot`;

      await _patch(url, {
        contextAfter: event.contextAfter,
        requestId: event.requestId,
        timestamp: event.timestamp,
      });
    });

  const finalResult: TAgentTracker["finalResult"] = (event) =>
    enqueue(async () => {
      if (!baseUrl) return;

      const url = `${baseUrl}/api/sessions/${encodeURIComponent(event.sessionId)}/finalize`;

      await _post(url, {
        result: event.result,
        stages: event.stages,
      });
    });

  const reset: TAgentTracker["reset"] = () => { };

  return {
    finalResult,
    modelResponse,
    pushRequest,
    registerSession,
    reset,
    stageFinish,
    toolCall,
  } satisfies TAgentTracker & {
    registerSession: (
      sessionId: string,
      opts: { forkLineage?: SessionForkLineagePayload; taskYahlPath: string },
    ) => Promise<void>;
  };
};
