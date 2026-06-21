import type { YahlStage } from "./yahl-stage";

export const CONTEXT_SCOPES = ["global", "types"] as const;
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
  stage: YahlStage;
  temperature?: number;
  context: {
    context: Map<string, unknown>;
    types: Map<string, unknown>;
  };
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
    questionRef: string;
    title: string;
    version: "askUser.v1";
  };
  tool: "ask_user";
  type: "tool_call";
};

export type StageToolCallEnvelope = SetContextToolCallEnvelope |
  AskUserToolCallEnvelope;

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
    typeof parsedArgs.questionRef === "string" &&
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
        questionRef: parsedArgs.questionRef.trim(),
        title: parsedArgs.title,
        version: "askUser.v1",
      },
      tool: "ask_user",
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
