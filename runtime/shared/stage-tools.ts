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
        "End this stage and jump the pipeline to another labeled stage declared in this stage's goto list. Use for /stage(id) in stage logic. Requires a non-empty reason. On success the current stage finishes without verify and the orchestrator continues from the target stage.",
      name: "goto_stage",
      parameters: {
        properties: {
          reason: {
            description: "Why this jump is needed (injected as stage_goto_reason on the target stage).",
            type: "string",
          },
          stageId: {
            description: "Authoring id of the target stage (must match a declared /stage(id) goto entry).",
            type: "string",
          },
        },
        required: ["stageId", "reason"],
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
            description: "Context write strategy. set overwrites; extend appends onto arrays (or [old, new] for non-arrays).",
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
        "Invoke a platform skill against the session API. Use for /platform(dispatch-task-run|propose-notification|propose-knowledge-transfer|get-knowledge-manager-instruction|put-knowledge-manager-instruction, ...) in stage logic. Topic resolve, media-to-text, and LLM helpers use the nixery tool. Knowledge reads use orchestrator nixeryRun stages + ~/nixery/{defId}/{output}. Returns JSON { ok, data } or { ok: false, error }.",
      name: "platform",
      parameters: {
        properties: {
          args: {
            description: "Skill-specific arguments object.",
            type: "object",
          },
          skill: {
            description: "Platform skill name.",
            enum: [
              "dispatch-task-run",
              "propose-notification",
              "propose-knowledge-transfer",
              "get-knowledge-manager-instruction",
              "put-knowledge-manager-instruction",
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
        "Run a nixery def inline from stage logic. Use for /nixery(defId, …) where the def has output.inlineTool: true in server/nixery/{defId}/index.yml. Returns JSON { ok, data } or { ok: false, error }.",
      name: "nixery",
      parameters: {
        properties: {
          args: {
            description: "Def-specific arguments object (topic, key, value, purpose, dryRun, …).",
            type: "object",
          },
          defId: {
            description: "Nixery def id under server/nixery/ with output.inlineTool: true.",
            type: "string",
          },
        },
        required: ["defId"],
        type: "object",
      },
    },
    type: "function" as const,
  },
];

export const parseNixeryToolArguments = (
  raw: string,
): { args: Record<string, unknown>; defId: string } | null => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (typeof parsed.defId !== 'string' || !parsed.defId.trim()) return null;

  const args = isRecord(parsed.args) ? parsed.args : {};

  return {
    args,
    defId: parsed.defId.trim(),
  };
};

export const parsePlatformToolArguments = (
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

export const parseGotoStageToolArguments = (
  raw: string,
): { reason: string; stageId: string } | null => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (typeof parsed.stageId !== "string" || !parsed.stageId.trim()) return null;
  if (typeof parsed.reason !== "string" || !parsed.reason.trim()) return null;

  return {
    reason: parsed.reason.trim(),
    stageId: parsed.stageId.trim(),
  };
};
