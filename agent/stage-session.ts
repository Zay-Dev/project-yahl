import { parseStageEnvelope, type StageEnvelope, type StageSessionInput } from "../shared/stage-contract";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

type StageReply =
  | {
    envelope: StageEnvelope;
    type: "envelope";
  }
  | {
    command: string;
    type: "bash";
  }
  | {
    type: "invalid_bash";
  }
  | {
    type: "invalid_output";
  };

type StageRunner = {
  chat: (messages: Message[]) => Promise<string>;
  runCommand: (command: string) => Promise<string>;
};

type StageSessionOptions = {
  maxBashCalls?: number;
  maxTurns?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const parseInternalBashCall = (value: string): StageReply => {
  const envelope = parseStageEnvelope(value);
  if (envelope) {
    return {
      envelope,
      type: "envelope",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return {
      type: "invalid_output",
    };
  }

  if (!isRecord(parsed)) {
    return {
      type: "invalid_output",
    };
  }

  if (parsed.type !== "tool_call" || parsed.tool !== "bash") {
    return {
      type: "invalid_output",
    };
  }

  if (!isRecord(parsed.arguments)) {
    return {
      type: "invalid_bash",
    };
  }

  if (typeof parsed.arguments.command !== "string") {
    return {
      type: "invalid_bash",
    };
  }

  if (!parsed.arguments.command.trim()) {
    return {
      type: "invalid_bash",
    };
  }

  return {
    command: parsed.arguments.command,
    type: "bash",
  };
};

const buildInstruction = () =>
  [
    "Return strict JSON only.",
    "Orchestrator output Schema 1:",
    "{\"type\":\"result\",\"output\":\"<text>\"}",
    "Orchestrator output Schema 2:",
    "{\"type\":\"tool_call\",\"tool\":\"set_context\",\"arguments\":{\"scope\":\"global|stage\",\"key\":\"<string>\",\"value\":<json>}}",
    "Internal tool Schema 3 (executed inside @agent container only):",
    "{\"type\":\"tool_call\",\"tool\":\"bash\",\"arguments\":{\"command\":\"<single shell command>\"}}",
    "Only set_context can be returned to orchestrator as tool_call.",
    "After bash result is returned to you, continue and eventually return Schema 1 or Schema 2.",
    "No markdown or extra fields.",
  ].join("\n");

export const runStageSession = async (
  stageInput: StageSessionInput,
  messages: Message[],
  runner: StageRunner,
  options: StageSessionOptions = {},
): Promise<StageEnvelope> => {
  const maxBashCalls = options.maxBashCalls ?? 8;
  const maxTurns = options.maxTurns ?? 20;
  const instruction = buildInstruction();
  const payload = JSON.stringify(stageInput, null, 2);
  const stageMessages: Message[] = [
    ...messages,
    {
      content: `${instruction}\n\nInput:\n${payload}`,
      role: "user",
    },
  ];

  let bashCalls = 0;
  let turns = 0;

  while (turns < maxTurns) {
    turns += 1;
    const reply = await runner.chat(stageMessages);
    stageMessages.push({
      content: reply,
      role: "assistant",
    });
    
    const parsed = parseInternalBashCall(reply);
    if (parsed.type === "envelope") return parsed.envelope;

    if (parsed.type === "bash") {
      if (bashCalls >= maxBashCalls) {
        return {
          output: `执行失败 内部 bash 工具调用次数超过限制 ${maxBashCalls}`,
          type: "result",
        };
      }

      bashCalls += 1;
      const commandResult = await runner.runCommand(parsed.command);
      console.log(parsed.command, ':', commandResult);
      stageMessages.push({
        content: `bash执行完毕 ${commandResult}`,
        role: "user",
      });
      continue;
    }

    if (parsed.type === "invalid_bash") {
      stageMessages.push({
        content: "执行失败 bash工具格式无效 你必须返回严格JSON且arguments.command为非空字符串",
        role: "user",
      });
      continue;
    }

    stageMessages.push({
      content: "执行失败 输出格式无效 你必须返回严格JSON对象并符合result set_context bash schema",
      role: "user",
    });
  }

  return {
    output: `执行失败 stage对话轮次超过限制 ${maxTurns}`,
    type: "result",
  };
};
