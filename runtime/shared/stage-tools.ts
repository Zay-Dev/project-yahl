import type OpenAI from "openai";

import {
  CONTEXT_SET_OPERATIONS,
  CONTEXT_SCOPES,
  AskUserToolCallEnvelope,
  RagToolCallEnvelope,
  type ContextScope,
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

export type SetContextToolArguments = SetContextToolCallEnvelope["arguments"];

export const BROWSER_MODES = ["goto", "act", "extract", "observe", "agent"] as const;

export type TBrowserMode = (typeof BROWSER_MODES)[number];

export type BrowserToolArguments = {
  instruction: string;
  maxSteps?: number;
  mode: TBrowserMode;
  schema?: Record<string, unknown>;
  url?: string;
};

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
          questionRef: {
            description: 'Registry ref matching /ask-user(<id>) in stage logic, e.g. "1".',
            type: "string",
          },
          title: { type: "string" },
          version: { enum: ["askUser.v1"], type: "string" },
        },
        required: ["version", "kind", "title", "options", "questionRef"],
        type: "object",
      },
    },
    type: "function" as const,
  },
  {
    function: {
      description:
        "Control a headless browser via Stagehand. Use for /stagehand(...) in stage logic: web search, page fetch, structured extract, observe elements, or multi-step agent tasks. Returns JSON { ok, data } or { ok: false, error }.",
      name: "browser",
      parameters: {
        properties: {
          instruction: {
            description: "Natural language instruction for act, extract, observe, or agent mode.",
            type: "string",
          },
          maxSteps: {
            description: "Max agent steps when mode is agent. Default 15.",
            type: "number",
          },
          mode: {
            description: "Stagehand operation mode.",
            enum: [...BROWSER_MODES],
            type: "string",
          },
          schema: {
            description: "JSON Schema for structured extract (extract mode only).",
            type: "object",
          },
          url: {
            description: "Required for goto; optional starting URL for other modes.",
            type: "string",
          },
        },
        required: ["mode", "instruction"],
        type: "object",
      },
    },
    type: "function" as const,
  },
  {
    function: {
      description:
        "Run a single shell command inside the agent container. Use for listing files, reading paths under /opt/skills, etc. Do not use for persisting context. Do not use echo/printf to fake other API tools; call those tools by name instead.",
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
];

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

export const parseBrowserToolArguments = (raw: string): BrowserToolArguments | null => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (typeof parsed.mode !== "string") return null;
  if (!BROWSER_MODES.includes(parsed.mode as TBrowserMode)) return null;
  if (typeof parsed.instruction !== "string") return null;
  if (!parsed.instruction.trim()) return null;

  const url = typeof parsed.url === "string" && parsed.url.trim() ? parsed.url.trim() : undefined;
  const maxSteps = typeof parsed.maxSteps === "number" && parsed.maxSteps > 0
    ? parsed.maxSteps
    : undefined;
  const schema = isRecord(parsed.schema) ? parsed.schema : undefined;

  if (parsed.mode === "goto" && !url) return null;

  return {
    instruction: parsed.instruction.trim(),
    ...(maxSteps === undefined ? {} : { maxSteps }),
    mode: parsed.mode as TBrowserMode,
    ...(schema === undefined ? {} : { schema }),
    ...(url === undefined ? {} : { url }),
  };
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
  if (typeof parsed.questionRef !== "string" || !parsed.questionRef.trim()) return null;
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
    questionRef: parsed.questionRef.trim(),
    title: parsed.title.trim(),
    version: "askUser.v1",
  };
};