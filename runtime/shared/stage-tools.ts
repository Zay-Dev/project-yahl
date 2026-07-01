import type OpenAI from "openai";

import {
  CONTEXT_SET_OPERATIONS,
  CONTEXT_SCOPES,
  AskUserToolCallEnvelope,
  type SetContextToolCallEnvelope,
} from "./stage-contract";
import { parseAskUserBatchToolArguments } from "./ask-user-batch";

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
        "Ask the user one or more questions in a single batch. All questions must be answered before the stage continues.",
      name: "ask_user",
      parameters: {
        properties: {
          batchId: {
            description: 'Unique id for this question batch, e.g. "stage1_round1".',
            type: "string",
          },
          description: { type: "string" },
          questions: {
            items: {
              properties: {
                allowMultiple: { type: "boolean" },
                description: { type: "string" },
                kind: { enum: ["text", "multipleChoice"], type: "string" },
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
                placeholder: { type: "string" },
                questionRef: { type: "string" },
                title: { type: "string" },
              },
              required: ["questionRef", "kind", "title"],
              type: "object",
            },
            minItems: 1,
            type: "array",
          },
          title: { type: "string" },
          version: { enum: ["askUserBatch.v1"], type: "string" },
        },
        required: ["version", "batchId", "title", "questions"],
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
        "Run a single shell command inside the agent container. Use for listing files, reading paths under /opt/skills, and curl for documented HTTP APIs in workspace files referenced by stage logic. Do not use curl for web search, HTML browse, or scraping. Do not use for persisting context. Do not use echo/printf to fake other API tools; call those tools by name instead.",
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
        "Invoke the mastermind gateway helper. Use for /mastermind(research|extract-info|extract-knowledge|persist-knowledge|resolve-topic|tidy-knowledge|media-to-text|plan|design-questions, ...) in stage logic. extract-knowledge writes ~/knowledge/{key}.json and returns key/path only — read .extracted from that file. Long calls auto-wait up to 90 minutes. Returns JSON { ok, data } or { ok: false, error, retryable?, requestStatus?, invocationId?, unavailable?, queueDepth? }.",
      name: "mastermind",
      parameters: {
        properties: {
          args: {
            description: "Skill-specific arguments object.",
            type: "object",
          },
          skill: {
            description: "Helper skill name.",
            enum: [
              "research",
              "extract-info",
              "extract-knowledge",
              "persist-knowledge",
              "resolve-topic",
              "tidy-knowledge",
              "media-to-text",
              "plan",
              "design-questions",
            ],
            type: "string",
          },
        },
        required: ["skill"],
        type: "object",
      },
    },
    type: "function" as const,
  },
  {
    function: {
      description:
        "Poll mastermind request activity for the current session stage request. Use for debugging long research calls — do not re-POST while status is queued or running. Returns { ok, agent, queueDepth, request: { status, skill, invocationId, startedAt, updatedAt } }.",
      name: "mastermind_status",
      parameters: {
        properties: {
          invocationId: {
            description: "Optional invocation id from a prior mastermind tool response.",
            type: "string",
          },
        },
        type: "object",
      },
    },
    type: "function" as const,
  },
];

export const parseMastermindStatusToolArguments = (
  raw: string,
): { invocationId?: string } => {
  if (!raw.trim()) {
    return {};
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return {};
  }

  if (!isRecord(parsed)) return {};

  const invocationId = typeof parsed.invocationId === 'string' && parsed.invocationId.trim()
    ? parsed.invocationId.trim()
    : undefined;

  return invocationId ? { invocationId } : {};
};

export const parseMastermindToolArguments = (
  raw: string,
): { args: Record<string, unknown>; skill: string } | null => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (typeof parsed.skill !== 'string' || !parsed.skill.trim()) return null;

  const args = isRecord(parsed.args) ? parsed.args : {};

  return {
    args,
    skill: parsed.skill.trim(),
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
): AskUserToolCallEnvelope["arguments"] | null => parseAskUserBatchToolArguments(raw);