import type { YahlStage } from "@/shared/yahl-stage";

import path from "path";

import {
  AGENT_SKILLS_CONTAINER_DIR,
  AGENT_YAHL_CONTAINER_DIR,
} from '@project-yahl/shared/agent-files/prepare-agent-files';

import config from "./config";

import { listReadableUtf8Files, readFileUtf8 } from "./-utils/prompts";

import { handleToolCalls } from './-utils/handle-tool-calls';
import { isOrchestratorHandledTool } from './-utils/orchestrator-handled-tools';
import { buildResumeStageMessages } from './-utils/resume-messages';
import { runBashCommand } from './-utils/run-bash-command';
import { runStageSession } from "./stage-session";
import { fastForward, type TContextBuckets } from './-utils/ff-client';
import { chatWithTools } from "./-utils/llm-client";
import { withLlmRequestContext } from "./-utils/llm-request-context";
import { isVmConditionBranch, wrapVmLogic } from "./condition-branch";
import { runScript, runConditionScript } from "./-utils/vm-client";
import { startAgentDiagnosticsLog } from './-utils/agent-diagnostics-log';

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
  if (!process.env.LLM_PROXY_TOKEN?.trim()) {
    console.warn("[WARN] Running without LLM_PROXY_TOKEN\n");
  }

  const { ensureStagehandBrowserBridge } = await import("./-browser/stagehand-browser-bridge");
  const bridge = await ensureStagehandBrowserBridge();

  console.log(`[yahl-browser-bridge] ready ${bridge.baseURL} (scripts: yahl-browser / echo JSON | yahl-browser)\n`);

  const cli = config.cliOptions;

  const agentmd = await readFileUtf8(cli.agentMdPath);
  const yahlFiles = await listReadableUtf8Files(cli.yahlDirPath);
  const yahlPrompt = (await Promise.all(yahlFiles.map(readFileUtf8)))
    .filter(Boolean)
    .join("\n\n");

  const catalogRootsNote = (
    cli.skillsDirPath !== AGENT_SKILLS_CONTAINER_DIR
    || cli.yahlDirPath !== AGENT_YAHL_CONTAINER_DIR
  )
    ? [
      `Catalog roots: skills=${cli.skillsDirPath}, yahl=${cli.yahlDirPath}.`,
      'When stage logic or tools reference /opt/skills or /opt/yahl, read from these roots instead.',
    ].join(' ')
    : '';

  const messages = [
    {
      content: [agentmd, catalogRootsNote, yahlPrompt].filter(Boolean).join("\n\n").trim(),
      role: "system" as const,
    },
  ];

  await subscriber.waitForReady();
  await startAgentDiagnosticsLog(config.cliOptions.sessionId);
  console.log(
    `[agent-daemon] yahl prompts sessionId=${cli.sessionId} `
    + `dir=${cli.yahlDirPath} files=${yahlFiles.map((file) => path.basename(file)).join(",") || "-"} `
    + `skillsDir=${cli.skillsDirPath}`,
  );
  console.log(`[agent-daemon] listening on ${config.redisUrl}\n`);

  while (true) {
    const envelope = await subscriber.waitForRequest();
    if (!envelope) continue;

    const {
      context,
      contextAfter,
      parsedStageIndex,
      prefixMessages,
      requestId,
      resumeFrom,
      stage,
      systemAppend,
      temperature,
    } = envelope;
    const effectiveTemperature = temperature ?? stage.temperature;
    const { end, error, onModelResponse, reportLocalToolCall, toolCall } = subscriber.getReply(requestId);

    console.log(
      `[agent-daemon] stage start sessionId=${config.cliOptions.sessionId} requestId=${requestId} `
      + `stageId=${stage.id ?? '-'} parsedStageIndex=${parsedStageIndex ?? '-'}`,
    );

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

        const envelope = await runStageSession(
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

              const result = await withLlmRequestContext(
                {
                  requestId,
                  sessionId: config.cliOptions.sessionId,
                },
                () => chatWithTools(messages, opts),
              );
              const durationMs = Date.now() - start;
              const toolCallCount = (result.tool_calls || []).length;

              console.log(
                `[agent-daemon] chat turn end requestId=${requestId} turn=${turn} durationMs=${durationMs} toolCalls=${toolCallCount}\n`,
              );

              const orchestratorCalls = (result.tool_calls || [])
                .filter(tool => isOrchestratorHandledTool(tool.function.name));
              const { toolCallMessages } = await handleToolCalls({
                storage: context,
                toolCall,
                toolCalls: orchestratorCalls,
              });

              return [
                result,
                ...toolCallMessages,
              ] as any[];
            },
          },
          {
            onLocalToolCall: async ({ call, resultContent }) => {
              await reportLocalToolCall(call, {
                hasError: false,
                result: resultContent,
              });
            },
            onLocalToolStart: async ({ timeoutMs }) => {
              console.log(
                `[agent-daemon] run_bash start requestId=${requestId} timeoutMs=${timeoutMs}`,
              );
            },
            onModelResponse,
            prefixMessages,
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

        const usage = envelope && !Array.isArray(envelope) && envelope.type === 'result'
          ? {
            bashCalls: envelope.bashCalls ?? 0,
            turns: envelope.turns ?? 0,
          }
          : undefined;

        return await end(usage);
      };

      await _runStage();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error && err.stack
        ? (err.stack.length > 500 ? `${err.stack.slice(0, 500)}…` : err.stack)
        : '-';

      console.error(
        `[agent-daemon] stage failed sessionId=${config.cliOptions.sessionId} requestId=${requestId} `
        + `message=${message} stack=${stack}`,
      );
      console.error(err);
      await error(err instanceof Error ? err : new Error(message));
    }
  }
};
