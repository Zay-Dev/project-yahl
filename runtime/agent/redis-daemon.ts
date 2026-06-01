import type { TStorage } from "@/shared/transports/-types";

import config from "./config";

import { exec } from "child_process";
import { promisify } from "util";

import { readFileUtf8, readFolderUtf8 } from "./-utils/prompts";

import { runStageSession } from "./stage-session";

import { fastForward } from "./-utils/ff-client";
import { chatWithTools } from "./-utils/llm-client";
import { runScript, runConditionScript } from "./-utils/vm-client";

type TGetReplyReturnType = ReturnType<typeof subscriber['getReply']>;

type TFastModel = 'vm' | 'fast-forward';

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

const _toSetContextToolCalls = async (
  model: TFastModel,
  requestId: string,
  context: Record<string, unknown>,
) => {
  return Object.entries(context)
    .map(([key, value], index) => ({
      arguments: {
        key,
        value,
        scope: "global" as const,
        operation: 'set' as const,
      },
      id: `${model}-${requestId}-${index}`,
      tool: "set_context",
      type: "tool_call" as const,
    }))
    .map((call) => ({
      id: call.id,
      type: 'function' as const,
      function: {
        name: call.tool,
        arguments: JSON.stringify(call.arguments),
      },
    }));
}

const _handleToolCalls = async (
  storage: TStorage,
  error: TGetReplyReturnType['error'],
  toolCall: TGetReplyReturnType['toolCall'],
  toolCalls: Awaited<ReturnType<typeof _toSetContextToolCalls>>,
) => {
  const toolCallMessages = new Array<{ role: 'tool'; content: string; tool_call_id: string; }>();

  for (const call of toolCalls) {
    const result = await toolCall(call);
    const baseMessage = { role: 'tool' as const, tool_call_id: call.id };

    if (result.hasError) {
      await error(new Error(result.result));

      toolCallMessages.push({ ...baseMessage, content: `tool call error: ${result.result}` });      
    } else if (result.newStorage) {
      const replace = (key: keyof TStorage) => {
        storage[key].clear();

        Object.entries(result.newStorage![key])
          .forEach(([key, value]) => {
            storage[key].set(key, value);
          });
      };

      replace('context');
      replace('types');

      toolCallMessages.push({ ...baseMessage, content: `tool call result: OK` });
    }
  }

  return { toolCallMessages };
};

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

    const { context, contextAfter, currentStage, requestId, temperature } = envelope;
    const { end, error, toolCall, onModelResponse } = subscriber.getReply(requestId);

    const _handleContextOutput = async (
      model: TFastModel,
      contextOutput: Record<string, unknown>,
    ) => {
      const calls = await _toSetContextToolCalls(
        model,
        requestId,
        contextOutput,
      );

      await _handleToolCalls(context, error, toolCall, calls);
    };

    try {
      const _runStage = async (script: string = currentStage) => {
        const lines = script.split('\n');

        if (!!contextAfter) {
          const contextOutput = await fastForward(contextAfter);

          await _handleContextOutput('fast-forward', contextOutput);
          return await end();
        } else if (lines[0]?.match(/\s*CONTEXT:/)) {
          const contextInput = context;
          const contextOutput = await runScript(
            ['{', ...lines.slice(1)].join('\n').trim(),
            contextInput,
          );

          await _handleContextOutput('vm', contextOutput);
          return await end();
        } else if (lines[0]?.match(/^\s*IF:/)) {
          const winningCondition = await runConditionScript(script, context);

          if (winningCondition) {
            await _runStage(winningCondition);
          }

          return;
        }

        await runStageSession(
          {
            context,
            temperature,
            currentStage: script,
          },
          messages,
          {
            runCommand,
            chatWithTools: async (messages, opts) => {
              const start = Date.now();
              const result = await chatWithTools(messages, opts);

              const allowedTools = ['set_context', 'ask_user', 'rag'];

              await onModelResponse({
                ...result.response,
                durationMs: Date.now() - start,
                thinkingMode: config.thinkingMode,
              });

              const { toolCallMessages } = await _handleToolCalls(
                context,
                error,
                toolCall,
                (result.tool_calls || [])
                  .filter(tool => allowedTools.includes(tool.function.name)),
              );

              return [
                result,
                ...toolCallMessages,
              ] as any[];
            },
          },
        );

        return await end();
      };

      await _runStage();
    } catch (err: any) {
      console.error(err);
      await error(err);
    }
  }
};
