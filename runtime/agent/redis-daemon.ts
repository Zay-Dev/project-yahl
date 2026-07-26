import type { TStorage } from "@/shared/transports/-types";
import type { YahlStage } from "@/shared/yahl-stage";

import config from "./config";

import { readFileUtf8, readFolderUtf8 } from "./-utils/prompts";

import { handleToolCalls } from './-utils/handle-tool-calls';
import { isOrchestratorHandledTool } from './-utils/orchestrator-handled-tools';
import { buildResumeStageMessages } from './-utils/resume-messages';
import { runBashCommand } from './-utils/run-bash-command';
import { runStageSession } from "./stage-session";

import { deriveModelResponseTags } from "@/shared/model-response-tags";

import { fastForward, type TContextBuckets } from './-utils/ff-client';
import { chatWithTools } from "./-utils/llm-client";
import { isVmConditionBranch, wrapVmLogic } from "./condition-branch";
import { runScript, runConditionScript } from "./-utils/vm-client";

type TFastModel = 'vm' | 'fast-forward';

const runCommand = async (command: string, timeoutMs = config.bashTimeoutMs) => {
  const result = await runBashCommand(command, timeoutMs);

  return result.output;
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

    const { context, contextAfter, requestId, resumeFrom, stage, systemAppend, temperature } = envelope;
    const effectiveTemperature = temperature ?? stage.temperature;
    const { end, error, toolCall, onModelResponse } = subscriber.getReply(requestId);

    const stageMessages = systemAppend
      ? [
        ...messages,
        {
          content: systemAppend.trim(),
          role: "system" as const,
        },
      ]
      : messages;

    const _handleContextOutput = async (
      model: TFastModel,
      buckets: TContextBuckets,
    ) => {
      const calls = _toSetContextToolCalls(model, requestId, buckets);

      await handleToolCalls({
        error,
        storage: context,
        toolCall,
        toolCalls: calls,
      });
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
          stageMessages,
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

              await onModelResponse({
                ...result.response,
                durationMs,
                tags: assistantMessage ? deriveModelResponseTags(assistantMessage) : ["unknown"],
                thinkingMode: config.thinkingMode,
              });

              const { toolCallMessages } = await handleToolCalls({
                error,
                storage: context,
                toolCall,
                toolCalls: (result.tool_calls || [])
                  .filter(tool => isOrchestratorHandledTool(tool.function.name)),
              });

              return [
                result,
                ...toolCallMessages,
              ] as any[];
            },
          },
          {
            onLocalToolCall: async ({ call }) => {
              await toolCall(call);
            },
            onLocalToolStart: async ({ call, timeoutMs }) => {
              console.log(
                `[agent-daemon] run_bash start requestId=${requestId} timeoutMs=${timeoutMs}`,
              );
              await toolCall(call);
            },
            requestId,
            resumeFrom,
            resumeMessages: resumeFrom ? buildResumeStageMessages(resumeFrom) : undefined,
            ...(stageSpec.maxBashCalls !== undefined
              ? { maxBashCalls: stageSpec.maxBashCalls }
              : {}),
            ...(stageSpec.maxTurns !== undefined
              ? { maxTurns: stageSpec.maxTurns }
              : {}),
          },
        );

        console.log(`[agent-daemon] stage session done requestId=${requestId}\n`);
        console.log(`[agent-daemon] stage end requestId=${requestId} pushing END\n`);

        return await end();
      };

      await _runStage();
    } catch (err: any) {
      console.error(err);
      await error(err);
    }
  }
};
