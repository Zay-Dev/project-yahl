import type OpenAI from "openai";

import { parseA2uiPlanV1 } from "./a2ui-plan";
import {
  CONTEXT_SET_OPERATIONS,
  CONTEXT_SCOPES,
  AskUserToolCallEnvelope,
  RagToolCallEnvelope,
  type ContextScope,
  type RenderA2uiPlanToolCallEnvelope,
  type SetContextToolCallEnvelope,
} from "./stage-contract";

export type ChatToolCall = {
  function: {
    arguments: string;
    name: string;
  };
  id: string;
  type: "function";
};

export type ChatAssistantMessage = {
  response: OpenAI.Chat.Completions.ChatCompletion;

  content: string | null;
  reasoning_content?: string | null;
  role: "assistant";
  tool_calls?: ChatToolCall[];
};

export type ChatApiMessage =
  | ChatAssistantMessage
  | {
    content: string;
    role: "system" | "user" | 'assistant';
  }
  | {
    content: string;
    role: "tool";
    tool_call_id: string;
  };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isScope = (value: unknown): value is ContextScope =>
  typeof value === "string" && CONTEXT_SCOPES.includes(value as ContextScope);

const isSetOperation = (value: unknown): value is SetContextToolArguments["operation"] =>
  typeof value === "string" &&
  CONTEXT_SET_OPERATIONS.includes(value as SetContextToolArguments["operation"]);

export type SetContextToolArguments = SetContextToolCallEnvelope["arguments"];

export const STAGE_TOOLS = [
  {
    function: {
      description:
        "Ask user a structured multiple-choice question. Use this when you need a human decision before continuing.",
      name: "ask_user",
      parameters: {
        properties: {
          allowMultiple: { type: "boolean" },
          description: { type: "string" },
          kind: { enum: ["multipleChoice"], type: "string" },
          maxChoices: { type: "number" },
          minChoices: { type: "number" },
          options: {
            items: {
              properties: {
                description: { type: "string" },
                id: { type: "string" },
                label: { type: "string" },
              },
              required: ["id", "label"],
              type: "object",
            },
            type: "array",
          },
          title: { type: "string" },
          version: { enum: ["askUser.v1"], type: "string" },
        },
        required: ["version", "kind", "title", "options"],
        type: "object",
      },
    },
    type: "function" as const,
  },
  {
    function: {
      description:
        "Run a single shell command inside the agent container. Use for listing files, reading paths under /opt/skills, etc. Do not use for persisting context. Do not use echo/printf to fake other API tools (e.g. render_a2ui_plan); call those tools by name instead.",
      name: "run_bash",
      parameters: {
        properties: {
          command: {
            description: "One non-empty shell command string.",
            type: "string",
          },
        },
        required: ["command"],
        type: "object",
      },
    },
    type: "function" as const,
  },
  {
    function: {
      description:
        "Persist a key-value pair to orchestrator runtime. scope global is shared across stages; scope stage is reset each stage; scope types is the type-definition bucket, shared across stages, always present in the agent input payload.",
      name: "set_context",
      parameters: {
        properties: {
          key: {
            description: "Non-empty string key.",
            type: "string",
          },
          scope: {
            description: "Target bucket.",
            enum: [...CONTEXT_SCOPES],
            type: "string",
          },
          operation: {
            description: "Context write strategy. set overwrites; extend stores [oldValue, newValue].",
            enum: [...CONTEXT_SET_OPERATIONS],
            type: "string",
          },
          value: {
            description: "Any JSON-serializable value.",
          },
        },
        required: ["scope", "key", "value"],
        type: "object",
      },
    },
    type: "function" as const,
  },
  {
    function: {
      description:
        "Perform a RAG operation on a file. Use for searching for information in a file.",
      name: "rag",
      parameters: {
        properties: {
          lookingFor: {
            description: "The content description of what we want to extract.",
            type: "string",
          },
          chunkSize: {
            description: "The size of each chunk to read from the file.",
            type: "number",
          },
          tmp_file_path: {
            description: "The path to the temporary file to read from.",
            type: "string",
          },
          byteLength: {
            description: "The length of the file in bytes.",
            type: "number",
          },
          context_key: {
            description: "The key to store the result in the context.",
            type: "string",
          },
        },
        required: ["lookingFor", "chunkSize", "tmp_file_path", "byteLength", "context_key"],
        type: "object",
      },
    },
    type: "function" as const,
  },
  {
    function: {
      description:
        "Emit A2UI v0.8 surfaces from structured context data using a compact plan (bindings are JSON pointers). Invoke this function tool directly after canonical JSON exists at dataRef (e.g. via set_context or CONTEXT). Do not emit via run_bash or echo. Last successful render is stored on the session at finalize. Does not duplicate large payloads.",
      name: "render_a2ui_plan",
      parameters: {
        properties: {
          dataRef: {
            description: "Where the canonical JSON value lives (global=context bucket, stage=per-stage, types=types bucket).",
            properties: {
              key: { type: "string" },
              scope: { enum: [...CONTEXT_SCOPES], type: "string" },
            },
            required: ["scope", "key"],
            type: "object",
          },
          plan: {
            description:
              "a2uiPlan.v1: surfaceId, ui_kind (summary_card|metric_cards|list_cards|detail_card|table), bindings map of slot->JSON pointer, optional column_bindings for table, optional limits.maxItems.",
            type: "object",
          },
          surfaceId: {
            description: "Optional A2UI surface id; defaults to YAHL stage id when omitted.",
            type: "string",
          },
          version: { enum: ["renderA2uiPlan.v1"], type: "string" },
        },
        required: ["version", "dataRef", "plan"],
        type: "object",
      },
    },
    type: "function" as const,
  },
];

export const parseSetContextToolArguments = (raw: string): SetContextToolArguments | null => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (!isScope(parsed.scope)) return null;
  if (parsed.operation !== undefined && !isSetOperation(parsed.operation)) return null;
  if (typeof parsed.key !== "string") return null;
  if (!parsed.key.trim()) return null;

  return {
    key: parsed.key,
    operation: parsed.operation === undefined ? "set" : parsed.operation,
    scope: parsed.scope,
    value: parsed.value,
  };
};

export const parseRagToolArguments = (raw: string): RagToolCallEnvelope["arguments"] | null => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (typeof parsed.lookingFor !== "string") return null;
  if (!parsed.lookingFor.trim()) return null;
  if (typeof parsed.chunkSize !== "number") return null;
  if (parsed.chunkSize <= 0) return null;
  if (typeof parsed.tmp_file_path !== "string") return null;
  if (!parsed.tmp_file_path.trim()) return null;
  if (typeof parsed.byteLength !== "number") return null;
  if (parsed.byteLength <= 0) return null;
  if (typeof parsed.context_key !== "string") return null;
  if (!parsed.context_key.trim()) return null;

  return {
    lookingFor: parsed.lookingFor,
    chunkSize: parsed.chunkSize,
    tmp_file_path: parsed.tmp_file_path,
    byteLength: parsed.byteLength,
    context_key: parsed.context_key,
  };
};

export const parseRunBashToolArguments = (raw: string): string | null => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (typeof parsed.command !== "string") return null;
  if (!parsed.command.trim()) return null;

  return parsed.command;
};

export const parseAskUserToolArguments = (
  raw: string,
): AskUserToolCallEnvelope["arguments"] | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.version !== "askUser.v1" || parsed.kind !== "multipleChoice") return null;
  if (typeof parsed.title !== "string" || !parsed.title.trim()) return null;
  if (!Array.isArray(parsed.options) || parsed.options.length < 2) return null;
  const options = parsed.options
    .filter((option) => isRecord(option))
    .map((option) => ({
      description: typeof option.description === "string" ? option.description : undefined,
      id: typeof option.id === "string" ? option.id.trim() : "",
      label: typeof option.label === "string" ? option.label.trim() : "",
    }))
    .filter((option) => option.id && option.label);
  if (options.length < 2) return null;
  return {
    allowMultiple: Boolean(parsed.allowMultiple),
    description: typeof parsed.description === "string" ? parsed.description : undefined,
    kind: "multipleChoice",
    maxChoices: typeof parsed.maxChoices === "number" ? parsed.maxChoices : undefined,
    minChoices: typeof parsed.minChoices === "number" ? parsed.minChoices : undefined,
    options,
    title: parsed.title.trim(),
    version: "askUser.v1",
  };
};

export const setContextArgumentsToEnvelope = (
  arguments_: SetContextToolArguments,
): SetContextToolCallEnvelope => ({
  arguments: arguments_,
  tool: "set_context",
  type: "tool_call",
});

export const ragArgumentsToEnvelope = (
  arguments_: RagToolCallEnvelope["arguments"],
): RagToolCallEnvelope => ({
  arguments: arguments_,
  tool: "rag",
  type: "tool_call",
});

export const askUserArgumentsToEnvelope = (
  arguments_: AskUserToolCallEnvelope["arguments"],
): AskUserToolCallEnvelope => ({
  arguments: arguments_,
  tool: "ask_user",
  type: "tool_call",
});

export const parseRenderA2uiPlanToolArguments = (
  raw: string,
): RenderA2uiPlanToolCallEnvelope["arguments"] | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.version !== "renderA2uiPlan.v1") return null;
  const planParsed = parseA2uiPlanV1(parsed.plan);
  if (!planParsed) return null;
  const dr = parsed.dataRef;
  if (!isRecord(dr)) return null;
  if (!isScope(dr.scope)) return null;
  if (typeof dr.key !== "string" || !dr.key.trim()) return null;

  return {
    dataRef: { key: dr.key.trim(), scope: dr.scope },
    plan: planParsed,
    surfaceId: typeof parsed.surfaceId === "string" ? parsed.surfaceId.trim() : undefined,
    version: "renderA2uiPlan.v1",
  };
};

export const renderA2uiPlanArgumentsToEnvelope = (
  arguments_: RenderA2uiPlanToolCallEnvelope["arguments"],
): RenderA2uiPlanToolCallEnvelope => ({
  arguments: arguments_,
  tool: "render_a2ui_plan",
  type: "tool_call",
});