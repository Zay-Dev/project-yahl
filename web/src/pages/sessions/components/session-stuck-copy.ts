import type { TResponseGetSession } from "@project-yahl/server/modules/sessions/-api-types";

export type TSessionStuckCopy = {
  body: string;
  title: string;
};

export const resolveSessionStuckCopy = (
  session: Pick<TResponseGetSession, "lastError">,
): TSessionStuckCopy => {
  const lastError = session.lastError;

  if (lastError?.code === "budget_burnout") {
    return {
      body: [
        lastError.message,
        lastError.stageId ? `Stage: ${lastError.stageId}.` : null,
      ].filter(Boolean).join(" "),
      title: "Budget exhausted",
    };
  }

  if (lastError) {
    return {
      body: [
        lastError.message,
        lastError.stageId ? `Stage: ${lastError.stageId}.` : null,
      ].filter(Boolean).join(" "),
      title: "Run failed",
    };
  }

  return {
    body:
      "The orchestrator is no longer running, but at least one stage is still marked as in progress. "
      + "Use Resume in the session header if a checkpoint exists, or check the orchestrator log on the server.",
    title: "Run stopped unexpectedly",
  };
};

export const resolveSessionStatusLabel = (
  session: Pick<TResponseGetSession, "deletedAt" | "lastError" | "runState">,
): string => {
  if (session.deletedAt) {
    return "Deleted";
  }

  if (session.runState === "active") {
    return "Running";
  }

  if (session.runState === "stuck") {
    if (session.lastError?.code === "budget_burnout") {
      return "Budget exhausted";
    }

    return "Stuck";
  }

  return "Idle";
};
