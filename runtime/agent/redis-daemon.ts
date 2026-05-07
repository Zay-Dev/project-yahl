import config from "./config";

import { exec } from "child_process";
import { promisify } from "util";

import { readFileUtf8, readFolderUtf8 } from "./-utils/prompts";

import { runStageSession } from "./stage-session";

import { fastForward } from "./-utils/ff-client";
import { chatWithTools } from "./-utils/llm-client";
import { runScript, runConditionScript } from "./-utils/vm-client";

type TReply = ReturnType<typeof subscriber.getReply>;

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

const _toToolsCall = async (
  model: 'vm' | 'fast-forward',
  context: Record<string, unknown>,
  reply: TReply['reply'],
  onModelResponse: TReply['onModelResponse'],
) => {
  const toolsCall = Object.entries(context)
    .map(([key, value]) => ({
      arguments: {
        key,
        value,
        scope: "global" as const,
        operation: 'set' as const,
      },
      tool: "set_context" as const,
      type: "tool_call" as const,
    }));

  await reply(toolsCall);

  await onModelResponse({
    durationMs: 0,
    thinkingMode: false,

    model,
    id: model,
    object: "chat.completion",
    created: Date.now(),

    choices: [{
      index: 0,
      finish_reason: "stop",
      logprobs: null,
      message: {
        content: "",
        role: "assistant",
        refusal: null,
        tool_calls: toolsCall.map((call) => ({
          id: model,
          type: 'function',
          function: {
            name: call.tool,
            arguments: JSON.stringify(call.arguments),
          },
        })),
      },
    }]
  });
}

export const startRedisDaemon = async () => {
  if (!config.apiKey) {
    console.warn("[WARN] Running without API KEY\n");
  }

  const cli = config.cliOptions;

  const agentmd = await readFileUtf8(cli.agentMdPath);
  const yahlPrompt = await readFolderUtf8(cli.yahlDirPath);

  const messages = [
    {
      content: `${agentmd}\n\n${yahlPrompt}`.trim(),
      role: "system" as const,
    },
  ];

  await subscriber.waitForReady();
  console.log(`[agent-daemon] listening on ${config.redisUrl}\n`);

  while (true) {
    const envelope = await subscriber.waitForRequest();
    if (!envelope) continue;

    const { requestId, context, currentStage, contextAfter } = envelope;
    const { reply, error, onModelResponse } = subscriber.getReply(requestId);
    try {
      const _runStage = async (script: string = currentStage) => {
        const lines = script.split('\n');

        if (!!contextAfter) {
          const contextOutput = await fastForward(contextAfter);
          await _toToolsCall('fast-forward', contextOutput, reply, onModelResponse);
          return;
        } else if (lines[0]?.match(/\s*CONTEXT:/)) {
          const contextInput = context;
          const contextOutput = await runScript(
            ['{', ...lines.slice(1)].join('\n').trim(),
            contextInput,
          );
  
          await _toToolsCall('vm', contextOutput, reply, onModelResponse);
          return;
        } else if (lines[0]?.match(/^\s*IF:/)) {
          const winningCondition = await runConditionScript(script, context);
          
          if (winningCondition) {
            await _runStage(winningCondition);
          }

          return;
        }
  
        const out = await runStageSession(
          { context, currentStage: script },
          messages,
          {
            runCommand,
            chatWithTools: async (messages) => {
              const start = Date.now();
              const result = await chatWithTools(messages);
  
              await onModelResponse({
                ...result.response,
                durationMs: Date.now() - start,
                thinkingMode: config.thinkingMode,
              });
  
              return result;
            },
          },
        );
  
        await reply(out);
      };

      await _runStage();
    } catch (err: any) {
      console.error(err);
      await error(err);
    }
  }
};
