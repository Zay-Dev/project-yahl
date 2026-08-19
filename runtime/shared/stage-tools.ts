import type OpenAI from "openai";

import {
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

export const BROWSER_MODES = ["goto", "act", "extract", "observe"] as const;

export type TBrowserMode = (typeof BROWSER_MODES)[number];

export type BrowserToolArguments = {
  instruction: string;
  mode: TBrowserMode;
  schema?: Record<string, unknown>;
  url?: string;
};

export const STAGE_TOOLS = [
  {
    function: {
      description:
        "Read /opt/skills/ask-user/SKILL.md first. Pause for a user question batch (askUserBatch.v1).",
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
        "Jump to a labeled stage in this stage's goto list (/stage(id)). Requires a non-empty reason. On success this stage ends without verify.",
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
        "Read /opt/skills/stagehand/SKILL.md first. Stagehand goto/act/extract/observe. Pass url only with goto. Returns JSON { ok, data } or { ok: false, error }.",
      name: "browser",
      parameters: {
        properties: {
          instruction: {
            description: "Natural language instruction for act, extract, or observe; or a short navigate note for goto.",
            type: "string",
          },
          mode: {
            description: "Stagehand operation mode. Use goto to navigate; act/extract/observe operate on the current page.",
            enum: [...BROWSER_MODES],
            type: "string",
          },
          schema: {
            description: "JSON Schema for structured extract (extract mode only).",
            type: "object",
          },
          url: {
            description:
              "Required for goto only. Omit for act, extract, and observe — passing url on those modes reloads the page.",
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
        "One shell command. List/read /opt/skills and ~/task-skills; curl only for documented workspace HTTP APIs. Not for persisting context or faking other tools.",
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
        "Append onto a context array (or pair non-array values). scope global is shared across stages; types is the type-definition bucket. Use instead of set_context when accumulating list items.",
      name: "extend_context",
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
          value: {
            description: "Any JSON-serializable value to append.",
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
        "Overwrite a key-value pair. scope global is shared across stages; types is the type-definition bucket. To append onto arrays use extend_context.",
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
        "Read /opt/skills/platform/SKILL.md first. /platform(...) against the session API. Returns JSON { ok, data } or { ok: false, error }.",
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
        "Read /opt/skills/nixery/SKILL.md first. /nixery(defId, …) inline abilities. Returns JSON { ok, data } or { ok: false, error }.",
      name: "nixery",
      parameters: {
        properties: {
          args: {
            description: "Def-specific arguments object (topic, key, value, purpose, dryRun, …).",
            type: "object",
          },
          defId: {
            description: "Nixery ability id (globally unique under server/nixery/{plugin}/) with output.inlineTool: true.",
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
  const schema = isRecord(parsed.schema) ? parsed.schema : undefined;

  if (parsed.mode === "goto" && !url) return null;
  if (parsed.mode !== "goto" && url) return null;

  return {
    instruction: parsed.instruction.trim(),
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
