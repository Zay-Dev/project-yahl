import type { TStorage } from "@/shared/transports/-types";
import type { YahlStage } from "@/shared/yahl-stage";

import config from "./config";

import { exec } from "child_process";
import { promisify } from "util";

import { readFileUtf8, readFolderUtf8 } from "./-utils/prompts";

import { buildResumeStageMessages } from './-utils/resume-messages';
import { runStageSession } from "./stage-session";

import { deriveModelResponseTags } from "@/shared/model-response-tags";

import { fastForward, type TContextBuckets } from './-utils/ff-client';
import { chatWithTools } from "./-utils/llm-client";
import { isVmConditionBranch, wrapVmLogic } from "./condition-branch";
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

const _contextBucketsFromVm = (
  output: Record<string, unknown>,
): TContextBuckets => ({
  context: output,
  types: {},
});

const _toSetContextToolCalls = (
  model: TFastModel,
  requestId: string,
  buckets: TContextBuckets,
) => {
  const specs = [
    ...Object.entries(buckets.context).map(([key, value]) => ({
      key,
      operation: 'set' as const,
      scope: 'global' as const,
      value,
    })),
    ...Object.entries(buckets.types).map(([key, value]) => ({
      key,
      operation: 'set' as const,
      scope: 'types' as const,
      value,
    })),
  ];

  return specs.map((arguments_, index) => ({
    id: `${model}-${requestId}-${index}`,
    type: 'function' as const,
    function: {
      name: 'set_context',
      arguments: JSON.stringify(arguments_),
    },
  }));
};

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

    const { context, contextAfter, requestId, resumeFrom, stage, temperature } = envelope;
    const effectiveTemperature = temperature ?? stage.temperature;
    const { end, error, toolCall, onModelResponse } = subscriber.getReply(requestId);

    const _handleContextOutput = async (
      model: TFastModel,
      buckets: TContextBuckets,
    ) => {
      const calls = _toSetContextToolCalls(model, requestId, buckets);

      await _handleToolCalls(context, error, toolCall, calls);
    };

    try {
      const _runStage = async (stageSpec: YahlStage = stage) => {
        if (contextAfter != null) {
          await _handleContextOutput('fast-forward', await fastForward(contextAfter));

          return await end();
        }

        if (stageSpec.contextMode) {
          const contextOutput = await runScript(
            wrapVmLogic(stageSpec.logic),
            context,
          );

          await _handleContextOutput('vm', _contextBucketsFromVm(contextOutput));
          return await end();
        }

        if (stageSpec.conditionMode) {
          const winningCondition = await runConditionScript(stageSpec.logic, context);

          if (!winningCondition) {
            return await end();
          }

          if (isVmConditionBranch(winningCondition)) {
            const contextOutput = await runScript(
              wrapVmLogic(winningCondition),
              context,
            );

            await _handleContextOutput('vm', _contextBucketsFromVm(contextOutput));
            return await end();
          }

          await _runStage({
            ...stageSpec,
            conditionMode: undefined,
            logic: winningCondition,
          });

          return;
        }

        let chatTurn = 0;

        await runStageSession(
          {
            context,
            stage: stageSpec,
            temperature: effectiveTemperature,
          },
          messages,
          {
            runCommand,
            chatWithTools: async (messages, opts) => {
              chatTurn += 1;
              const turn = chatTurn;
              const start = Date.now();

              console.log(`[agent-daemon] chat turn start requestId=${requestId} turn=${turn}\n`);

              const result = await chatWithTools(messages, opts);
              const durationMs = Date.now() - start;
              const assistantMessage = result.response.choices?.[0]?.message;
              const toolCallCount = (result.tool_calls || []).length;

              console.log(
                `[agent-daemon] chat turn end requestId=${requestId} turn=${turn} durationMs=${durationMs} toolCalls=${toolCallCount}\n`,
              );

              const allowedTools = ['set_context', 'ask_user', 'rag'];

              await onModelResponse({
                ...result.response,
                durationMs,
                tags: assistantMessage ? deriveModelResponseTags(assistantMessage) : ["unknown"],
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
          {
            resumeFrom,
            resumeMessages: resumeFrom ? buildResumeStageMessages(resumeFrom) : undefined,
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
