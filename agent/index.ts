import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import readline from "readline";
import { promisify } from "util";

import "dotenv/config";
import { type StageSessionInput } from "../shared/stage-contract";
import { runStageSession } from "./stage-session";

const execAsync = promisify(exec);

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

type CliOptions = {
  agentMdPath: string;
  nonInteractive: boolean;
  promptBase64: string;
  stageInputBase64: string;
  yahlDirPath: string;
};

type AgentReply = {
  approach: "command" | "complete";
  command: string;
  summary: string;
};

const deepseekApiKey = process.env.DEEPSEEK_API_KEY || process.env.API_KEY || "";

const deepseekBaseUrl = (process.env.DEEPSEEK_URL || "https://api.deepseek.com").replace(/\/+$/, "");

const model = process.env.DEEPSEEK_MODEL || "deepseek-reasoner";

const decodeBase64 = (text: string) => {
  try {
    return Buffer.from(text, "base64").toString("utf-8").trim();
  } catch {
    return "";
  }
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const pairs = args.reduce((acc, value, index) => {
    if (!value.startsWith("--")) return acc;
    const key = value.replace(/^--/, "");
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      acc[key] = "true";
      return acc;
    }
    acc[key] = next;
    return acc;
  }, {} as Record<string, string>);

  const defaultAgentMdPath = path.resolve(moduleDir, "Agent.md");
  const defaultYahlDirPath = path.resolve(process.cwd(), "orchestrator", "YAHL");

  return {
    agentMdPath: pairs["agent-md"] || process.env.AGENT_MD_PATH || defaultAgentMdPath,
    nonInteractive: pairs["non-interactive"] === "true" || process.env.AGENT_NON_INTERACTIVE === "1",
    promptBase64: pairs["prompt-base64"] || process.env.AGENT_PROMPT_BASE64 || "",
    stageInputBase64: pairs["stage-input-base64"] || process.env.AGENT_STAGE_INPUT_BASE64 || "",
    yahlDirPath: pairs["yahl-dir"] || process.env.AGENT_YAHL_DIR || defaultYahlDirPath,
  };
};

const readUtf8 = async (filePath: string) => {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return "";
  }
};

const readYahlPrompt = async (dirPath: string) => {
  try {
    const entries = await fs.readdir(dirPath, {
      withFileTypes: true,
    });
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.resolve(dirPath, entry.name))
      .sort((a, b) => a.localeCompare(b));
    const contents = await Promise.all(files.map(readUtf8));
    return contents.filter(Boolean).join("\n\n");
  } catch {
    return "";
  }
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

const parseStageSessionInput = (text: string): StageSessionInput | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const top = parsed as Record<string, unknown>;
  if (typeof top.currentStage !== "string") return null;
  if (!top.context || typeof top.context !== "object" || Array.isArray(top.context)) return null;
  const context = top.context as Record<string, unknown>;
  if (!context.context || typeof context.context !== "object" || Array.isArray(context.context)) return null;
  if (!context.stage || typeof context.stage !== "object" || Array.isArray(context.stage)) return null;

  return {
    context: {
      context: context.context as Record<string, unknown>,
      stage: context.stage as Record<string, unknown>,
    },
    currentStage: top.currentStage,
  };
};

const chat = async (messages: Message[]) => {
  const response = await fetch(`${deepseekBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${deepseekApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      model,
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
  if (!deepseekApiKey) {
    throw new Error("Missing API_KEY or DEEPSEEK_API_KEY in environment");
  }

  const cli = parseArgs();
  const agentmd = await readUtf8(cli.agentMdPath);
  const yahlPrompt = await readYahlPrompt(cli.yahlDirPath);
  const prompt = decodeBase64(cli.promptBase64);
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
      chat,
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
