import "dotenv/config";

import { exec } from "child_process";
import { promisify } from "util";

import Redis from "ioredis";

import {
  REQUEST_QUEUE,
  USAGE_CHANNEL,
  replyQueue,
  type StageRequestEnvelope,
} from "../shared/transport";

import { parseArgs } from "./-utils/args-parser";
import { readFileUtf8, readFolderUtf8 } from "./-utils/prompts";

import config from "./config";

import { runStageSession } from "./stage-session";
import { chatWithTools, setUsageEmitter } from "./-utils/llm-client";

const execAsync = promisify(exec);

const runCommand = async (command: string) => {
  try {
    const result = await execAsync(command, {
      maxBuffer: 20 * 1024 * 1024,
      timeout: 60 * 1000,
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

export const startRedisDaemon = async () => {
  if (!config.apiKey) {
    process.stderr.write("[WARN] Running without API KEY\n");
  }

  const cli = parseArgs();

  const redis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 2,
  });
  const agentmd = await readFileUtf8(cli.agentMdPath);
  const yahlPrompt = await readFolderUtf8(cli.yahlDirPath);

  const messages = [
    {
      content: `${agentmd}\n\n${yahlPrompt}`.trim(),
      role: "system" as const,
    },
  ];

  process.stderr.write(`[agent-daemon] listening on ${config.redisUrl}\n`);

  while (true) {
    const popped = await redis.brpop(REQUEST_QUEUE, 0);

    if (!popped) continue;

    const [, raw] = popped;
    let envelope: StageRequestEnvelope;

    try {
      envelope = JSON.parse(raw) as StageRequestEnvelope;
    } catch {
      continue;
    }

    const { requestId, sessionId, stageInput } = envelope;

    setUsageEmitter((payload) => {
      void redis.publish(USAGE_CHANNEL, JSON.stringify(payload));
    });

    try {
      const out = await runStageSession(stageInput, messages, {
        chatWithTools: (m) => chatWithTools(m, {
          requestId,
          sessionId,
        }),
        runCommand,
      });

      await redis.lpush(replyQueue(requestId), JSON.stringify(out));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await redis.lpush(
        replyQueue(requestId),
        JSON.stringify({
          output: message,
          type: "result",
        }),
      );
    } finally {
      setUsageEmitter(null);
    }
  }
};
