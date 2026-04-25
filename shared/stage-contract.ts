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

export type StageEnvelope = StageResultEnvelope | SetContextToolCallEnvelope[];

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

  if (isRecord(parsed)) {
    if (parsed.type === "result") {
      return {
        output: `${parsed.output || ''}`,
        type: "result",
      };
    }
  }

  if (!Array.isArray(parsed)) return null;

  return parsed
    .filter(item => {
      return isRecord(item) &&
        item.type === "tool_call" &&
        item.tool === "set_context" &&
        isRecord(item.arguments) &&
        isScope(item.arguments.scope) &&
        typeof item.arguments.key === 'string' &&
        item.arguments.key.trim();
    })
    .map(item => ({
      arguments: {
        key: item.arguments.key,
        scope: item.arguments.scope,
        value: item.arguments.value,
      },
      tool: "set_context",
      type: "tool_call",
    }));

};
