import type { TAgentTracker } from "./index";

import { createSessionEventTracker } from "../session-event-tracker";

type RegisterSessionOpts = {
  forkLineage?: {
    sourceRequestId: string;
    sourceSessionId: string;
    stageIndex: number;
  };
  taskYahlPath: string;
};

export const createStepTracker = () => {
  const api = createSessionEventTracker();

  const pushRequest: NonNullable<TAgentTracker["pushRequest"]> = (event) => {
    api.createStage(event.sessionId, {
      context: event.contextBefore as Record<string, unknown>,
      requestId: event.requestId,
      stage: event.stage,
      temperature: event.temperature,
    });
  };

  const toolCall: NonNullable<TAgentTracker["toolCall"]> = (event) => {
    api.appendToolCall(event.sessionId, {
      requestId: event.requestId,
      toolCalls: event.toolCalls,
    });
  };

  const modelResponse: NonNullable<TAgentTracker["modelResponse"]> = (event) => {
    api.appendModelResponse(event.sessionId, {
      requestId: event.requestId,
      response: event.response,
    });
  };

  const stageFinish: NonNullable<TAgentTracker["stageFinish"]> = (event) => {
    api.patchStage(event.sessionId, {
      contextAfter: event.contextAfter as Record<string, unknown>,
      requestId: event.requestId,
    });
  };

  const registerSession = async (sessionId: string, opts: RegisterSessionOpts) => {
    await api.registerSession(sessionId, { taskYahlPath: opts.taskYahlPath });
  };

  return {
    getSessionTokenTotals: api.getSessionTokenTotals,
    modelResponse,
    pushRequest,
    registerSession,
    stageFinish,
    toolCall,
  };
};
