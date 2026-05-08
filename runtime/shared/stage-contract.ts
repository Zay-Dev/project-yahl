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
    plan: A2uiPlanV1;
    surfaceId?: string;
    version: "renderA2uiPlan.v1";
  };
  tool: "render_a2ui_plan";
  type: "tool_call";
};

export type StageEnvelope = StageResultEnvelope |
  SetContextToolCallEnvelope[] |
  RagToolCallEnvelope |
  AskUserToolCallEnvelope |
  RenderA2uiPlanToolCallEnvelope;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isScope = (value: unknown): value is ContextScope =>
  typeof value === "string" && CONTEXT_SCOPES.includes(value as ContextScope);

const isSetOperation = (value: unknown): value is ContextSetOperation =>
  typeof value === "string" &&
  CONTEXT_SET_OPERATIONS.includes(value as ContextSetOperation);

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
      const parsedArgs = parsed.arguments as Record<string, unknown>;

      if (
        parsed.tool === "ask_user" &&
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

      if (parsed.tool === "render_a2ui_plan" && parsedArgs.version === "renderA2uiPlan.v1") {
        const dr = parsedArgs.dataRef;
        const planParsed = parseA2uiPlanV1(parsedArgs.plan);
        if (
          isRecord(dr) &&
          isScope(dr.scope) &&
          typeof dr.key === "string" &&
          dr.key.trim() &&
          planParsed
        ) {
          return {
            arguments: {
              dataRef: { key: dr.key.trim(), scope: dr.scope },
              plan: planParsed,
              surfaceId: typeof parsedArgs.surfaceId === "string" ? parsedArgs.surfaceId.trim() : undefined,
              version: "renderA2uiPlan.v1",
            },
            tool: "render_a2ui_plan",
            type: "tool_call",
          };
        }
      }

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
        (item.arguments.operation === undefined || isSetOperation(item.arguments.operation)) &&
        typeof item.arguments.key === 'string' &&
        item.arguments.key.trim();
    })
    .map(item => ({
      arguments: {
        key: item.arguments.key,
        operation: item.arguments.operation || "set",
        scope: item.arguments.scope,
        value: item.arguments.value,
      },
      tool: "set_context",
      type: "tool_call",
    }));

};
