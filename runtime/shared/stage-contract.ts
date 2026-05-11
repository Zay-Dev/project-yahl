import { parseA2uiPlanV1, type A2uiPlanV1 } from "./a2ui-plan";

export const CONTEXT_SCOPES = ["global", "stage", "types"] as const;
export const CONTEXT_SET_OPERATIONS = ["set", "extend"] as const;
export const RUNTIME_BUCKETS = ["context", "stage", "types"] as const;
export const STAGE_ENVELOPE_TYPES = ["result", "tool_call"] as const;

export type ContextScope = (typeof CONTEXT_SCOPES)[number];
export type ContextSetOperation = (typeof CONTEXT_SET_OPERATIONS)[number];
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
  temperature?: number;
};

export type StageResultEnvelope = {
  output: string;
  type: "result";
};

export type SetContextToolCallEnvelope = {
  arguments: {
    key: string;
    operation: ContextSetOperation;
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

export type AskUserToolCallEnvelope = {
  arguments: {
    allowMultiple?: boolean;
    description?: string;
    kind: "multipleChoice";
    maxChoices?: number;
    minChoices?: number;
    options: {
      description?: string;
      id: string;
      label: string;
    }[];
    title: string;
    version: "askUser.v1";
  };
  tool: "ask_user";
  type: "tool_call";
};

export type RenderA2uiPlanToolCallEnvelope = {
  arguments: {
    dataRef: {
      key: string;
      scope: ContextScope;
    };
    mode: "append" | "replace";
    plan: A2uiPlanV1;
    surfaceId?: string;
    version: "renderA2uiPlan.v1";
  };
  tool: "render_a2ui_plan";
  type: "tool_call";
};

export type StageToolCallEnvelope = SetContextToolCallEnvelope |
  RagToolCallEnvelope |
  AskUserToolCallEnvelope |
  RenderA2uiPlanToolCallEnvelope;

export type StageEnvelope = StageResultEnvelope |
  StageToolCallEnvelope[] |
  StageToolCallEnvelope;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isScope = (value: unknown): value is ContextScope =>
  typeof value === "string" && CONTEXT_SCOPES.includes(value as ContextScope);

const isSetOperation = (value: unknown): value is ContextSetOperation =>
  typeof value === "string" &&
  CONTEXT_SET_OPERATIONS.includes(value as ContextSetOperation);

const isRenderMode = (value: unknown): value is RenderA2uiPlanToolCallEnvelope["arguments"]["mode"] =>
  value === "append" || value === "replace";

const parseToolCallEnvelope = (item: unknown): StageToolCallEnvelope | null => {
  if (!isRecord(item)) return null;
  if (item.type !== "tool_call") return null;
  if (!isRecord(item.arguments)) return null;

  const parsedArgs = item.arguments as Record<string, unknown>;

  if (
    item.tool === "ask_user" &&
    typeof parsedArgs.version === "string" &&
    parsedArgs.version === "askUser.v1" &&
    parsedArgs.kind === "multipleChoice" &&
    typeof parsedArgs.title === "string" &&
    Array.isArray(parsedArgs.options)
  ) {
    return {
      arguments: {
        allowMultiple: Boolean(parsedArgs.allowMultiple),
        description:
          typeof parsedArgs.description === "string" ? parsedArgs.description : undefined,
        kind: "multipleChoice",
        maxChoices:
          typeof parsedArgs.maxChoices === "number" ? parsedArgs.maxChoices : undefined,
        minChoices:
          typeof parsedArgs.minChoices === "number" ? parsedArgs.minChoices : undefined,
        options: parsedArgs.options
          .filter((option) => option && typeof option === "object")
          .map((option: any) => ({
            description: typeof option.description === "string" ? option.description : undefined,
            id: String(option.id || ""),
            label: String(option.label || ""),
          }))
          .filter((option) => option.id && option.label),
        title: parsedArgs.title,
        version: "askUser.v1",
      },
      tool: "ask_user",
      type: "tool_call",
    };
  }

  if (item.tool === "render_a2ui_plan" && parsedArgs.version === "renderA2uiPlan.v1") {
    const dr = parsedArgs.dataRef;
    const planParsed = parseA2uiPlanV1(parsedArgs.plan);
    const mode = parsedArgs.mode;
    const parsedMode = mode === undefined ? "replace" : mode;
    if (
      isRecord(dr) &&
      isScope(dr.scope) &&
      typeof dr.key === "string" &&
      dr.key.trim() &&
      planParsed &&
      isRenderMode(parsedMode)
    ) {
      return {
        arguments: {
          dataRef: { key: dr.key.trim(), scope: dr.scope },
          mode: parsedMode,
          plan: planParsed,
          surfaceId: typeof parsedArgs.surfaceId === "string" ? parsedArgs.surfaceId.trim() : undefined,
          version: "renderA2uiPlan.v1",
        },
        tool: "render_a2ui_plan",
        type: "tool_call",
      };
    }
    return null;
  }

  if (
    item.tool === "rag" &&
    typeof parsedArgs.lookingFor === "string" &&
    typeof parsedArgs.chunkSize === "number" &&
    typeof parsedArgs.tmp_file_path === "string" &&
    typeof parsedArgs.byteLength === "number" &&
    typeof parsedArgs.context_key === "string" &&
    !!parsedArgs.lookingFor.trim() &&
    parsedArgs.chunkSize > 0 &&
    !!parsedArgs.tmp_file_path.trim() &&
    parsedArgs.byteLength > 0 &&
    !!parsedArgs.context_key.trim()
  ) {
    return {
      arguments: {
        lookingFor: parsedArgs.lookingFor,
        chunkSize: parsedArgs.chunkSize,
        tmp_file_path: parsedArgs.tmp_file_path,
        byteLength: parsedArgs.byteLength,
        context_key: parsedArgs.context_key,
      },
      tool: "rag",
      type: "tool_call",
    };
  }

  if (
    item.tool === "set_context" &&
    isScope(parsedArgs.scope) &&
    (parsedArgs.operation === undefined || isSetOperation(parsedArgs.operation)) &&
    typeof parsedArgs.key === "string" &&
    parsedArgs.key.trim()
  ) {
    return {
      arguments: {
        key: parsedArgs.key,
        operation: parsedArgs.operation || "set",
        scope: parsedArgs.scope,
        value: parsedArgs.value,
      },
      tool: "set_context",
      type: "tool_call",
    };
  }

  return null;
};

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

    return parseToolCallEnvelope(parsed);
  }

  if (!Array.isArray(parsed)) return null;

  const envelopes = parsed
    .map((item) => parseToolCallEnvelope(item))
    .filter((item): item is StageToolCallEnvelope => !!item);

  return envelopes.length ? envelopes : null;

};
