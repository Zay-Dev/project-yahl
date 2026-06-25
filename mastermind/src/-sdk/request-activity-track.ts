import type { TMastermindAgent } from './agent.js';

import {
  markRequestActivityRunning,
  setRequestActivityFailed,
} from './request-activity.js';
import type { TRequestActivityKind } from './request-activity.js';

export type TRequestActivityRef = {
  invocationId?: string;
  requestId: string;
  sessionId: string;
};

export const resolveRequestActivityRef = (
  sessionId: string | undefined,
  requestId: string | undefined,
  invocationId?: string,
): TRequestActivityRef | null => {
  const trimmedSessionId = sessionId?.trim();
  const trimmedRequestId = requestId?.trim();
  const trimmedInvocationId = invocationId?.trim();

  if (!trimmedSessionId || !trimmedRequestId) {
    return null;
  }

  return {
    requestId: trimmedRequestId,
    sessionId: trimmedSessionId,
    ...(trimmedInvocationId ? { invocationId: trimmedInvocationId } : {}),
  };
};

export const wrapPromptWithRequestActivity = (
  agent: TMastermindAgent,
  activity: TRequestActivityRef | null,
): TMastermindAgent['prompt'] => {
  if (!activity) {
    return agent.prompt;
  }

  return (message, options) => {
    markRequestActivityRunning(
      activity.sessionId,
      activity.requestId,
      activity.invocationId,
    );

    return agent.prompt(message, options);
  };
};

export const failRequestActivity = (
  activity: TRequestActivityRef | null,
  params: {
    error: string;
    kind: TRequestActivityKind;
    skill?: string;
    unavailable?: boolean;
  },
) => {
  if (!activity) {
    return;
  }

  setRequestActivityFailed({
    error: params.error,
    kind: params.kind,
    requestId: activity.requestId,
    sessionId: activity.sessionId,
    invocationId: activity.invocationId,
    ...(params.skill ? { skill: params.skill } : {}),
    ...(params.unavailable ? { unavailable: true } : {}),
  });
};
