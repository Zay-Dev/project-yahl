import {
  CONTEXT_SCOPES,
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
  content: string | null;
  reasoning_content?: string | null;
  role: "assistant";
  tool_calls?: ChatToolCall[];
};

export type ChatApiMessage =
  | ChatAssistantMessage
  | {
    content: string;
    role: "system" | "user";
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

export type SetContextToolArguments = SetContextToolCallEnvelope["arguments"];

export const STAGE_TOOLS = [
  {
    function: {
      description:
        "Run a single shell command inside the agent container. Use for listing files, reading paths under /opt/skills, etc. Do not use for persisting context.",
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
        "Persist a key-value pair to orchestrator runtime context. scope global is shared across stages; scope stage is reset each stage.",
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

export const parseSetContextToolArguments = (raw: string): SetContextToolArguments | null => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (!isScope(parsed.scope)) return null;
  if (typeof parsed.key !== "string") return null;
  if (!parsed.key.trim()) return null;

  return {
    key: parsed.key,
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