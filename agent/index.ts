import config from "./config";

import { exec } from "child_process";
import readline from "readline";
import { promisify } from "util";

import {
  STAGE_TOOLS,
  type ChatApiMessage,
  type ChatAssistantMessage,
} from "../shared/stage-tools";

import { parseArgs } from "./-utils/args-parser";
import { readFileUtf8, readFolderUtf8, decodeBase64 } from "./-utils/prompts";

import {
  runStageSession,
  normalizeToolCalls,
  parseStageSessionInput,
} from "./stage-session";

const execAsync = promisify(exec);

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AgentReply = {
  approach: "command" | "complete";
  command: string;
  summary: string;
};

const ask = (rl: readline.Interface, text: string) =>
  new Promise<string>((resolve) => rl.question(text, resolve));

const parseAgentReply = (reply: string): AgentReply | null => {
  try {
    const data = JSON.parse(reply) as Partial<AgentReply>;
    if (!data || typeof data !== "object") return null;
    if (data.approach !== "command" && data.approach !== "complete") return null;
    if (typeof data.command !== "string") return null;
    if (typeof data.summary !== "string") return null;
    return {
      approach: data.approach,
      command: data.command,
      summary: data.summary,
    };
  } catch {
    return null;
  }
};

const chat = async (messages: Message[]) => {
  const response = await fetch(`${config.apiUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: config.apiKey && `Bearer ${config.apiKey}` || '',
    },
    body: JSON.stringify({
      messages,
      model: config.model,
      thinking: {
        type: config.thinkingMode ? "enabled" : "disabled",
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${body}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content?.trim() || "";
};

const chatWithTools = async (
  messages: ChatApiMessage[],
): Promise<{
  assistantMessage: ChatAssistantMessage;
}> => {
  const response = await fetch(`${config.apiUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: config.apiKey && `Bearer ${config.apiKey}` || '',
    },
    body: JSON.stringify({
      messages,
      model: config.model,
      thinking: {
        type: config.thinkingMode ? "enabled" : "disabled",
      },
      tool_choice: "auto",
      tools: STAGE_TOOLS,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${body}`);
  }

  const data = await response.json() as {
    choices?: Array<{
      message?: {
        content?: string | null;
        reasoning_content?: string | null;
        tool_calls?: unknown;
      };
    }>;
  };

  if (config.debug) {
    process.stderr.write(`[DEBUG] [REPLY] ${JSON.stringify(data, null, 2)}\n`);
  }

  const message = data.choices?.[0]?.message;
  if (!message) {
    throw new Error("DeepSeek API returned no message");
  }

  const tool_calls = normalizeToolCalls(message.tool_calls);
  const content =
    typeof message.content === "string" || message.content === null
      ? message.content
      : null;
  const reasoning_content =
    typeof message.reasoning_content === "string" || message.reasoning_content === null
      ? message.reasoning_content
      : null;

  return {
    assistantMessage: {
      content,
      tool_calls,
      reasoning_content,
      role: "assistant",
    },
  };
};

const runCommand = async (command: string) => {
  try {
    const result = await execAsync(command, {
      maxBuffer: 20 * 1024 * 1024,
    });
    return `${result.stdout || ""}${result.stderr || ""}`;
  } catch (error) {
    const failed = error as {
      message?: string;
      stderr?: string;
      stdout?: string;
    };
    return `${failed.stdout || ""}${failed.stderr || ""}${failed.message || ""}`;
  }
};

const runLoop = async (messages: Message[]) => {
  while (true) {
    const reply = await chat(messages);

    messages.push({
      role: "assistant",
      content: reply,
    });
    process.stdout.write(`\n\x1b[32m[AI] ${reply}\x1b[0m\n`);

    const parsed = parseAgentReply(reply);
    if (!parsed) {
      const errorText = "执行失败 输出格式无效 你必须返回严格JSON对象并包含 approach command summary";
      messages.push({
        role: "user",
        content: errorText,
      });
      process.stdout.write(`\n[Agent] ${errorText}\n`);
      continue;
    }

    if (parsed.approach === "complete") {
      if (parsed.command.trim()) {
        const errorText = "执行失败 approach=complete 时 command 必须为空字符串";
        messages.push({
          role: "user",
          content: errorText,
        });
        process.stdout.write(`\n[Agent] ${errorText}\n`);
        continue;
      }
      if (!parsed.summary.trim()) {
        const errorText = "执行失败 approach=complete 时 summary 不能为空";
        messages.push({
          role: "user",
          content: errorText,
        });
        process.stdout.write(`\n[Agent] ${errorText}\n`);
        continue;
      }
      break;
    }

    if (!parsed.command.trim()) {
      const errorText = "执行失败 approach=command 时 command 不能为空";
      messages.push({
        role: "user",
        content: errorText,
      });
      process.stdout.write(`\n[Agent] ${errorText}\n`);
      continue;
    }

    if (parsed.summary.trim()) {
      const errorText = "执行失败 approach=command 时 summary 必须为空字符串";
      messages.push({
        role: "user",
        content: errorText,
      });
      process.stdout.write(`\n[Agent] ${errorText}\n`);
      continue;
    }

    const commandResult = await runCommand(parsed.command);

    process.stdout.write(`\n[Agent] 执行完毕 : ${commandResult}\n`);
    messages.push({
      role: "user",
      content: `执行完毕 ${commandResult}`,
    });
  }
};

const runInteractive = async (messages: Message[]) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    while (true) {
      const userInput = (await ask(rl, "\n[你] ")).trim();
      if (!userInput) continue;

      messages.push({
        role: "user",
        content: userInput,
      });
      await runLoop(messages);
    }
  } finally {
    rl.close();
  }
};

const run = async () => {
  if (!config.apiKey) {
    process.stderr.write('[WARN] Running without API KEY');
  }

  const cli = parseArgs();
  const prompt = decodeBase64(cli.promptBase64);
  const agentmd = await readFileUtf8(cli.agentMdPath);
  const yahlPrompt = await readFolderUtf8(cli.yahlDirPath);

  const messages: Message[] = [
    {
      role: "system",
      content: `${agentmd}\n\n${yahlPrompt}`.trim(),
    },
  ];

  if (cli.stageInputBase64) {
    const stageInputRaw = decodeBase64(cli.stageInputBase64);
    const stageInput = parseStageSessionInput(stageInputRaw);

    if (!stageInput) {
      throw new Error("Invalid AGENT_STAGE_INPUT_BASE64 payload");
    }

    const envelope = await runStageSession(stageInput, messages, {
      chatWithTools,
      runCommand,
    });

    process.stdout.write(`${JSON.stringify(envelope)}\n`);
    return;
  }

  if (cli.nonInteractive || prompt) {
    messages.push({
      role: "user",
      content: prompt,
    });

    await runLoop(messages);
    return;
  }

  await runInteractive(messages);
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[Agent Error] ${message}\n`);
  process.exit(1);
});
