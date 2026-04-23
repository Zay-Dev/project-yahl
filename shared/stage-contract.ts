export const CONTEXT_SCOPES = ["global", "stage"] as const;
export const RUNTIME_BUCKETS = ["context", "stage"] as const;
export const STAGE_ENVELOPE_TYPES = ["result", "tool_call"] as const;

export type ContextScope = (typeof CONTEXT_SCOPES)[number];
export type RuntimeBucket = (typeof RUNTIME_BUCKETS)[number];
export type StageEnvelopeType = (typeof STAGE_ENVELOPE_TYPES)[number];

export type StageContextPayload = {
  context: Record<string, unknown>;
  stage: Record<string, unknown>;
};

export type StageSessionInput = {
  context: StageContextPayload;
  currentStage: string;
};

export type StageResultEnvelope = {
  output: string;
  type: "result";
};

export type SetContextToolCallEnvelope = {
  arguments: {
    key: string;
    scope: ContextScope;
    value: unknown;
  };
  tool: "set_context";
  type: "tool_call";
};

export type StageEnvelope = StageResultEnvelope | SetContextToolCallEnvelope;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isScope = (value: unknown): value is ContextScope =>
  typeof value === "string" && CONTEXT_SCOPES.includes(value as ContextScope);

export const parseStageEnvelope = (value: string): StageEnvelope | null => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (parsed.type === "result") {
    if (typeof parsed.output !== "string") return null;
    return {
      output: parsed.output,
      type: "result",
    };
  }

  if (parsed.type !== "tool_call") return null;
  if (parsed.tool !== "set_context") return null;
  if (!isRecord(parsed.arguments)) return null;
  if (!isScope(parsed.arguments.scope)) return null;
  if (typeof parsed.arguments.key !== "string") return null;
  if (!parsed.arguments.key.trim()) return null;

  return {
    arguments: {
      key: parsed.arguments.key,
      scope: parsed.arguments.scope,
      value: parsed.arguments.value,
    },
    tool: "set_context",
    type: "tool_call",
  };
};
