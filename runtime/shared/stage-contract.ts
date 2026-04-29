export const CONTEXT_SCOPES = ["global", "stage", "types"] as const;
export const RUNTIME_BUCKETS = ["context", "stage", "types"] as const;
export const STAGE_ENVELOPE_TYPES = ["result", "tool_call"] as const;

export type ContextScope = (typeof CONTEXT_SCOPES)[number];
export type RuntimeBucket = (typeof RUNTIME_BUCKETS)[number];
export type StageEnvelopeType = (typeof STAGE_ENVELOPE_TYPES)[number];

export type StageContextPayload = {
  context: Record<string, unknown>;
  stage: Record<string, unknown>;
  types: Record<string, unknown>;
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

export type RagToolCallEnvelope = {
  arguments: {
    lookingFor: string;
    chunkSize: number;
    tmp_file_path: string;
    byteLength: number;
    context_key: string;
  };
  tool: "rag";
  type: "tool_call";
};

export type StageEnvelope = StageResultEnvelope |
  SetContextToolCallEnvelope[] |
  RagToolCallEnvelope;

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

  const isValidTool = (item: unknown) => {
    return isRecord(item) &&
      item.type === "tool_call" &&
      isRecord(item.arguments);
  };

  if (isRecord(parsed)) {
    if (parsed.type === "result") {
      return {
        output: `${parsed.output || ''}`,
        type: "result",
      };
    }

    if (isValidTool(parsed)) {
      return [parsed]
        .filter(item => {
          return item.tool === "rag" &&
            isRecord(item.arguments) &&
            typeof item.arguments.lookingFor === 'string' &&
            typeof item.arguments.chunkSize === 'number' &&
            typeof item.arguments.tmp_file_path === 'string' &&
            typeof item.arguments.byteLength === 'number' &&
            typeof item.arguments.context_key === 'string' &&
            !!item.arguments.lookingFor.trim() &&
            item.arguments.chunkSize > 0 &&
            !!item.arguments.tmp_file_path.trim() &&
            item.arguments.byteLength > 0 &&
            !!item.arguments.context_key.trim();
        })
        .map((item: any) => ({
          arguments: {
            lookingFor: item.arguments.lookingFor,
            chunkSize: item.arguments.chunkSize,
            tmp_file_path: item.arguments.tmp_file_path,
            byteLength: item.arguments.byteLength,
            context_key: item.arguments.context_key,
          },
          tool: "rag" as const,
          type: "tool_call" as const,
        }))[0];
    }
  }

  if (!Array.isArray(parsed)) return null;

  return parsed
    .filter(item => {
      return isValidTool(item) &&
        item.tool === "set_context" &&
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
