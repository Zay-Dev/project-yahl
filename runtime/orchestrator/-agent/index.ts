import { randomUUID } from 'crypto';

import type { TResumeStage, TRunYahl } from './-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { TStorage } from '@/shared/transports/-types';

import { toAgentStage } from '@/shared/yahl-stage';
import { parseNixeryToolArguments } from '@/shared/stage-tools';

import { parseYahlDocument, parseYahlFile } from '@/orchestrator/-utils/yahl';
import { createStorage } from '@/orchestrator/-tools/set_context';
import { seedRunInputContext } from '@/orchestrator/-context/default-context';

import { resolveEffectiveStageTemperature } from '@/orchestrator/-utils/yahl/stage-parse';
import { AskUserPausedError, handleAskUserToolCall } from '@/orchestrator/-ask-user';
import {
  buildGotoSystemAppend,
  clearStageGotoContext,
  handleGotoStageToolCall,
  type TGotoStageTransfer,
} from '@/orchestrator/-goto';
import { runVerifyGate, isVerifyRubricFailure } from '@/orchestrator/-verify';
import {
  applyVerifyRecoveryToStorage,
  buildVerifyRecoverySystemAppend,
  parsedStagesMatchSlot,
  resolveActiveStageForVerifyRecoveryBound,
  shouldRotateRequestIdForBoundStage,
  stripProduceKeysFromStorage,
  verifyAutoRetryMaxIterations,
} from '@/orchestrator/-verify/resume-helpers';

import {
  applySetContextToolCall,
  filterStorageForStage,
} from '@/orchestrator/-context';

import {
  loadNixeryDef,
  resolveNixeryInlineRetryMax,
  resolveNixerySoftFailToolResult,
  resolveNixeryStageInput,
  runNixeryDef,
  runNixeryInlineTool,
  teardownNixeryContainer,
} from '@/orchestrator/-nixery';
import { isTypesPreambleStage, seedTypesPreamble } from '@project-yahl/shared/yahl/types-preamble';
import {
  buildProduceKeysSystemAppend,
  missingProduceKeys,
  pauseForProduceKeys,
  produceKeysMaxRetries,
  writeProduceKeysDiagnostic,
} from './produce-keys-retry';
import { handleLoop } from './loop';
import {
  resolveStageWaitMaxMs,
  StageWaitTimeoutError,
} from './stage-wait-timeout';
import { startStageWaitHeartbeat } from './stage-wait-heartbeat';

const AGENT_LOCAL_TOOLS = new Set(['browser', 'platform', 'run_bash']);

const serializeStorageSnapshot = (storage: TStorage) => ({
  context: Object.fromEntries(storage.context.entries()),
  types: Object.fromEntries(storage.types.entries()),
});

type TRunYahlOptions = NonNullable<Parameters<TRunYahl>[1]>;

type TProduceKeysRetryOutcome = 'break' | 'continue';

class YahlAgentRunner {
  private readonly storage: TStorage;

  private readonly stages: ParsedStage[];

  private readonly startIndex: number;

  private readonly sessionId: string;

  private readonly agentName: string;

  private readonly maxProduceKeysRetries = produceKeysMaxRetries();

  private readonly maxNixeryInlineRetries = resolveNixeryInlineRetryMax();

  private nixerySoftFails = 0;

  private options: TRunYahlOptions;

  private requestId = '';

  private activeStage!: ParsedStage;

  private filteredStorage!: TStorage;

  private systemAppendParts: string[] = [];

  private produceKeysAttempt = 0;

  private resumeStage?: TResumeStage;

  private pipelineStageIndex = 0;

  private boundParsedStageIndex = 0;

  private boundStage!: ParsedStage;

  private boundSourceStartLine = 0;

  private stageDocSourceStartLine?: number;

  private temperature: number | undefined;

  private pendingGotoTransfer: TGotoStageTransfer | null = null;

  private gotoCount = 0;

  private enteredViaGoto = false;

  constructor(
    yahl: string,
    {
      useStorage = () => createStorage(),
      ...options
    }: TRunYahlOptions = {},
  ) {
    this.storage = useStorage();
    const runInputContextKeys = yahl.trim()
      ? parseYahlDocument(yahl).runInput
      : undefined;

    seedRunInputContext(
      this.storage,
      options.runInput,
      runInputContextKeys,
    );
    this.options = options;
    this.startIndex = options.startFromStageIndex ?? 0;

    if (options.stages?.length) {
      this.stages = options.stages;
    } else if (yahl.trim()) {
      this.stages = parseYahlFile(yahl);
    } else {
      throw new Error('runYahl: yahl text or options.stages is required');
    }

    this.sessionId = globalThis.sessionId;
    this.agentName = `agent-${this.sessionId}`;
  }

  async run() {
    let stageIndex = this.startIndex;

    while (stageIndex < this.stages.length) {
      const stage = this.stages[stageIndex]!;

      this.pipelineStageIndex = this.options.pipelineStageIndex != null
        ? this.options.pipelineStageIndex + (stageIndex - this.startIndex)
        : stageIndex;

      const isResumingThisStage = Boolean(
        this.options.resumeStage && stageIndex === this.startIndex,
      );

      this.temperature = resolveEffectiveStageTemperature(stage, {
        loopMeta: this.options.loopMeta,
        temperature: this.options.temperature,
      });

      if (stage.type === 'loop' && !this.options.contextAfter && !isResumingThisStage) {
        this.enteredViaGoto = false;
        await handleLoop(
          stage,
          this.storage,
          runYahl,
          this.temperature,
          this.pipelineStageIndex,
          this.options.recoveryStages ?? this.stages,
        );
        stageIndex += 1;
        continue;
      }

      if (!isResumingThisStage && isTypesPreambleStage(stage, stageIndex)) {
        seedTypesPreamble(this.storage.types, stage.spec.logic);
        this.resetStageContext(stage, stageIndex, false);
        await this.finishOrchestratorDirectStage();
        stageIndex += 1;
        continue;
      }

      this.resetStageContext(stage, stageIndex, isResumingThisStage);
      const nextStageIndex = await this.runOneStage();
      stageIndex = nextStageIndex ?? stageIndex + 1;
    }

    return {
      storage: this.storage,
    };
  }

  private resetStageContext(
    stage: ParsedStage,
    parsedStageIndex: number,
    isResumingThisStage: boolean,
  ) {
    this.resumeStage = isResumingThisStage
      ? this.options.resumeStage
      : undefined;

    this.boundParsedStageIndex = this.options.parsedStageIndex ?? parsedStageIndex;
    this.boundStage = stage;
    this.boundSourceStartLine = stage.sourceStartLine;
    this.stageDocSourceStartLine = undefined;
    this.pendingGotoTransfer = null;

    if (!this.enteredViaGoto) {
      clearStageGotoContext(this.storage);
    }

    this.enteredViaGoto = false;

    const resumedStage = this.resumeStage?.stage;

    this.activeStage = resumedStage && parsedStagesMatchSlot(resumedStage, this.boundStage)
      ? resumedStage
      : this.boundStage;

    this.filteredStorage = filterStorageForStage(
      this.storage,
      this.activeStage.lines,
      this.activeStage,
      this.options.loopMeta?.indexName,
    );

    this.systemAppendParts = [];
    this.requestId = this.resumeStage?.requestId ?? randomUUID();
    this.produceKeysAttempt = 0;
    this.verifyRetryAttempt = 0;

    if (this.options.systemAppend) {
      this.systemAppendParts.push(this.options.systemAppend);
    }

    const gotoAppend = buildGotoSystemAppend(this.activeStage);

    if (gotoAppend) {
      this.systemAppendParts.push(gotoAppend);
    }
  }

  private async runStageBody() {
    if (this.isPrefixFastForwardMode()) {
      await this.runStageAttempt();
      return;
    }

    while (true) {
      await this.runStageAttempt();

      if (this.pendingGotoTransfer) {
        break;
      }

      if ((await this.resolveProduceKeysRetry()) === 'break') {
        break;
      }
    }
  }

  private async resolveProduceKeysRetry(): Promise<TProduceKeysRetryOutcome> {
    const missingKeys = missingProduceKeys(this.activeStage, this.storage);

    if (missingKeys.length === 0) {
      return 'break';
    }

    if (this.produceKeysAttempt < this.maxProduceKeysRetries) {
      this.produceKeysAttempt += 1;

      const diagnostic = await writeProduceKeysDiagnostic({
        attempt: this.produceKeysAttempt,
        requestId: this.requestId,
        sessionId: this.sessionId,
        stage: this.activeStage,
        storage: this.storage,
      });

      const retryAppend = buildProduceKeysSystemAppend({
        agentPath: diagnostic.agentPath,
        missingKeys: diagnostic.missingKeys,
      });

      this.systemAppendParts = this.systemAppendParts.filter(
        (part) => !part.includes('The previous stage run did not produce required context keys.'),
      );
      this.systemAppendParts.push(retryAppend);
      return 'continue';
    }

    if (this.options.produceKeysResumeAttempt) {
      throw new Error(
        `stage finished without produceContextKeys: ${missingKeys.join(', ')}`,
      );
    }

    const diagnostic = await writeProduceKeysDiagnostic({
      attempt: this.produceKeysAttempt + 1,
      requestId: this.requestId,
      sessionId: this.sessionId,
      stage: this.activeStage,
      storage: this.storage,
    });

    await pauseForProduceKeys({
      agentName: this.agentName,
      diagnosticPath: diagnostic.agentPath,
      missingKeys,
      pipelineStageIndex: this.pipelineStageIndex,
      requestId: this.requestId,
      sessionId: this.sessionId,
      stage: this.activeStage,
      storage: this.storage,
    });

    return 'break';
  }

  private async runStageAttempt() {
    let paused = false;
    let pauseError: AskUserPausedError | null = null;

    this.nixerySoftFails = 0;

    const onPause = () => {
      paused = true;
    };

    const stageSpec = this.activeStage.spec;
    const skipStageCreate = this.produceKeysAttempt > 0 || Boolean(this.resumeStage);
    const systemAppend = this.systemAppendParts.filter(Boolean).join('\n\n') || undefined;

    if (!skipStageCreate) {
      this.stageDocSourceStartLine = this.activeStage.sourceStartLine;
    }

    const { disposeWait, wait, getWaitForToolCall } = await publisher.pushRequest(
      this.filteredStorage,
      toAgentStage(stageSpec),
      this.requestId,
      {
        contextAfter: this.options.contextAfter,
        loopMeta: this.resumeStage?.loopMeta ?? this.options.loopMeta,
        parsedStageIndex: this.boundParsedStageIndex,
        persistedStage: stageSpec,
        resumeFrom: this.resumeStage?.resumeFrom,
        skipStageCreate,
        sourceStartLine: this.boundSourceStartLine,
        systemAppend,
        temperature: this.temperature,
      },
    );

    await globalThis.sessionTracker?.flush?.();

    const toolCallHandlers = getWaitForToolCall(async (toolCall) => {
      try {
        if (toolCall.function.name === 'set_context') {
          const outcome = await applySetContextToolCall(
            this.storage,
            toolCall,
            this.activeStage,
          );

          if (outcome.invalidJson) {
            return {
              hasError: false,
              result: `set_context: invalid JSON arguments: ${outcome.invalidJson}`,
            };
          }

          return {
            hasError: false,
            result: outcome.applied ? 'OK' : 'skipped',
            newStorage: this.storage,
          };
        }

        if (toolCall.function.name === 'ask_user') {
          return await handleAskUserToolCall({
            onPause,
            agentName: this.agentName,

            requestId: this.requestId,
            sessionId: this.sessionId,

            storage: this.storage,
            toolCall,

            stage: this.activeStage,

            forkSetupIndex: this.options.forkSetupIndex,
            loopMeta: this.resumeStage?.loopMeta ?? this.options.loopMeta,

            ...(this.options.forkSetupIndex != null
              ? {}
              : { stageIndex: this.pipelineStageIndex }),
          });
        }

        if (toolCall.function.name === 'goto_stage') {
          const gotoResult = handleGotoStageToolCall({
            currentParsedStageIndex: this.boundParsedStageIndex,
            gotoCount: this.gotoCount,
            stages: this.options.recoveryStages ?? this.stages,
            stage: this.activeStage,
            storage: this.storage,
            toolCall,
          });

          if (gotoResult.transfer) {
            this.pendingGotoTransfer = gotoResult.transfer;
            this.gotoCount += 1;
          }

          return {
            hasError: gotoResult.hasError,
            result: gotoResult.result,
          };
        }

        if (toolCall.function.name === 'nixery') {
          try {
            const nixeryArgs = parseNixeryToolArguments(toolCall.function.arguments ?? '{}');

            if (!nixeryArgs) {
              this.nixerySoftFails += 1;

              return resolveNixerySoftFailToolResult({
                maxRetries: this.maxNixeryInlineRetries,
                result: { ok: false, error: 'nixery: invalid arguments' },
                softFailCount: this.nixerySoftFails,
              });
            }

            const result = await runNixeryInlineTool({
              args: nixeryArgs.args,
              defId: nixeryArgs.defId,
              requestId: this.requestId,
              sessionId: this.sessionId,
            });
            const { defRunCompleted, ...gate } = result as Record<string, unknown> & {
              defRunCompleted?: boolean;
              ok: boolean;
            };

            if (!gate.ok && defRunCompleted !== true) {
              this.nixerySoftFails += 1;
            }

            return resolveNixerySoftFailToolResult({
              abandonAfterDefRun: defRunCompleted === true,
              maxRetries: this.maxNixeryInlineRetries,
              result: gate as Record<string, unknown> & { ok: boolean },
              softFailCount: this.nixerySoftFails,
            });
          } catch (error) {
            if (error instanceof AskUserPausedError) {
              throw error;
            }

            this.nixerySoftFails += 1;
            const message = error instanceof Error ? error.message : String(error);

            return resolveNixerySoftFailToolResult({
              maxRetries: this.maxNixeryInlineRetries,
              result: { ok: false, error: message },
              softFailCount: this.nixerySoftFails,
            });
          }
        }

        if (AGENT_LOCAL_TOOLS.has(toolCall.function.name)) {
          return {
            hasError: false,
            result: 'OK',
          };
        }
      } catch (error) {
        if (error instanceof AskUserPausedError) {
          pauseError = error;
          throw error;
        }

        return {
          hasError: true,
          result: `Error: ${error}`,
        };
      }

      return {
        hasError: true,
        result: `No such tool: ${toolCall.function.name}`,
      };
    });

    const pausePromise = new Promise<never>((_, reject) => {
      const interval = setInterval(() => {
        if (paused || pauseError) {
          clearInterval(interval);
          reject(pauseError ?? new AskUserPausedError());
        }
      }, 50);
    });

    const toolCallPromise = toolCallHandlers.wait();
    const waitStartedAt = Date.now();
    const stageWaitMaxMs = resolveStageWaitMaxMs();
    let stageWaitTimer: ReturnType<typeof setTimeout> | undefined;

    const stageWaitTimeoutPromise = stageWaitMaxMs == null
      ? null
      : new Promise<never>((_, reject) => {
        stageWaitTimer = setTimeout(() => {
          reject(new StageWaitTimeoutError(this.requestId, stageWaitMaxMs));
        }, stageWaitMaxMs);
      });

    console.log(
      `[orchestrator] stage wait start requestId=${this.requestId}`
      + (stageWaitMaxMs == null ? '' : ` maxMs=${stageWaitMaxMs}`),
    );
    console.log(
      `[yahl-diag] race start requestId=${this.requestId} resumeStage=${Boolean(this.options.resumeStage)} pid=${process.pid}`
      + (stageWaitMaxMs == null ? '' : ` stageWaitMaxMs=${stageWaitMaxMs}`),
    );

    const heartbeat = startStageWaitHeartbeat({
      getElapsedMs: () => Date.now() - waitStartedAt,
      requestId: this.requestId,
      sessionId: this.sessionId,
      stageId: this.activeStage?.spec?.id,
      stageIndex: this.pipelineStageIndex,
    });

    try {
      await Promise.race([
        wait(),
        pausePromise,
        ...(stageWaitTimeoutPromise ? [stageWaitTimeoutPromise] : []),
      ]);
    } catch (error) {
      heartbeat.clear();
      disposeWait();
      toolCallHandlers.dispose();
      await toolCallPromise.catch(() => {});

      const errorName = error instanceof Error ? error.name : 'unknown';
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error && error.stack
        ? (error.stack.length > 500 ? `${error.stack.slice(0, 500)}…` : error.stack)
        : '-';

      console.log(
        `[orchestrator] stage wait end requestId=${this.requestId} durationMs=${Date.now() - waitStartedAt} outcome=error`,
      );
      console.log(
        `[yahl-diag] race error requestId=${this.requestId} errorName=${errorName} errorMessage=${errorMessage} `
        + `stack=${errorStack} stageIndex=${this.pipelineStageIndex} `
        + `stageId=${this.activeStage?.spec?.id ?? '-'} sessionId=${this.sessionId} endReceived=false pid=${process.pid}`,
      );

      globalThis.orchestratorFailureCursor = {
        kind: 'pipeline',
        stageIndex: this.pipelineStageIndex,
      };

      if (error instanceof AskUserPausedError) {
        throw error;
      }

      throw error;
    } finally {
      heartbeat.clear();

      if (stageWaitTimer) {
        clearTimeout(stageWaitTimer);
      }
    }

    toolCallHandlers.dispose();
    await toolCallPromise.catch(() => {});

    console.log(
      `[orchestrator] stage wait end requestId=${this.requestId} durationMs=${Date.now() - waitStartedAt} outcome=ok`,
    );
    console.log(`[yahl-diag] race ok requestId=${this.requestId} pid=${process.pid}`);

    if (this.options.resumeStage) {
      this.options.resumeStage = undefined;
    }
  }

  private verifyRetryAttempt = 0;

  private isPrefixFastForwardMode() {
    return Boolean(this.options.verifyFastForward && this.options.contextAfter);
  }

  private persistOrchestratorDirectStage() {
    globalThis.sessionTracker?.createStage(this.sessionId, {
      context: serializeStorageSnapshot(this.filteredStorage),
      parsedStageIndex: this.boundParsedStageIndex,
      requestId: this.requestId,
      sourceStartLine: this.boundSourceStartLine,
      stage: toAgentStage(this.activeStage.spec),
      temperature: this.temperature,
    });
  }

  private async finishOrchestratorDirectStage() {
    this.persistOrchestratorDirectStage();

    publisher.emitStageFinish({
      requestId: this.requestId,
      contextAfter: this.storage,
    });
    await globalThis.sessionTracker?.flush?.();
  }

  private async runOneStage(): Promise<number | undefined> {
    const nixeryRun = this.activeStage.spec.nixeryRun;

    if (nixeryRun) {
      const nixeryInput = this.activeStage.spec.nixeryInput;

      if (!nixeryInput) {
        throw new Error('nixeryRun stage requires nixeryInput');
      }

      const { def } = await loadNixeryDef(nixeryRun);

      this.persistOrchestratorDirectStage();
      await globalThis.sessionTracker?.flush?.();

      const { containerName } = await runNixeryDef({
        defId: nixeryRun,
        input: resolveNixeryStageInput(this.filteredStorage, nixeryInput, def.input),
        requestId: this.requestId,
        sessionId: this.sessionId,
        skipTeardown: true,
      });

      publisher.emitStageFinish({
        requestId: this.requestId,
        contextAfter: this.storage,
      });
      await globalThis.sessionTracker?.flush?.();
      await teardownNixeryContainer(containerName, this.sessionId, nixeryRun);
      return undefined;
    }

    const maxVerifyRetries = verifyAutoRetryMaxIterations();
    const verifyAutoRetry = this.activeStage.spec.verify?.autoRetry === true;

    while (true) {
      await this.runStageBody();

      const finishContextAfter = this.options.contextAfterRecord ?? this.storage;
      const gotoTransfer = this.pendingGotoTransfer;

      if (gotoTransfer) {
        this.pendingGotoTransfer = null;
        this.enteredViaGoto = true;

        console.log(
          `[yahl-diag] stage goto skip-verify requestId=${this.requestId}`
          + ` target=${gotoTransfer.stageId} index=${gotoTransfer.targetStageIndex} pid=${process.pid}`,
        );

        publisher.emitStageFinish({ requestId: this.requestId, contextAfter: finishContextAfter });

        globalThis.sessionTracker?.patchSession?.(this.sessionId, {
          runCursor: {
            kind: 'pipeline',
            stageIndex: gotoTransfer.targetStageIndex,
          },
        });

        await globalThis.sessionTracker?.flush?.();
        return gotoTransfer.targetStageIndex;
      }

      console.log(
        `[yahl-diag] verify gate start requestId=${this.requestId} stageIndex=${this.pipelineStageIndex} pid=${process.pid}`,
      );

      const verifyResult = await runVerifyGate({
        agentName: this.agentName,
        pipelineStageIndex: this.pipelineStageIndex,
        requestId: this.requestId,
        sessionId: this.sessionId,
        stage: this.activeStage,
        storage: this.storage,
        shutdownOnFail: !verifyAutoRetry || this.verifyRetryAttempt >= maxVerifyRetries,
        throwOnFail: !verifyAutoRetry || this.verifyRetryAttempt >= maxVerifyRetries,
        verifyFastForward: this.options.verifyFastForward,
      });

      if (verifyResult.pass) {
        if (!parsedStagesMatchSlot(this.activeStage, this.boundStage)) {
          throw new Error(
            `stage slot integrity: activeStage sourceStartLine=${this.activeStage.sourceStartLine} ` +
            `does not match bound stage sourceStartLine=${this.boundSourceStartLine}`,
          );
        }

        console.log(`[yahl-diag] stage finish emit requestId=${this.requestId} pid=${process.pid}`);

        publisher.emitStageFinish({ requestId: this.requestId, contextAfter: finishContextAfter });
        await globalThis.sessionTracker?.flush?.();
        return undefined;
      }

      if (!verifyAutoRetry || this.verifyRetryAttempt >= maxVerifyRetries) {
        return undefined;
      }

      if (!isVerifyRubricFailure(verifyResult)) {
        return undefined;
      }

      this.verifyRetryAttempt += 1;

      const resumeAction = verifyResult.resumeAction ?? 'rerun';

      applyVerifyRecoveryToStorage({
        askUserRef: verifyResult.askUserRef,
        failedChecks: verifyResult.failedChecks,
        feedback: verifyResult.feedback,
        resumeAction,
        storage: this.storage,
      });

      stripProduceKeysFromStorage(this.storage, this.activeStage);

      this.activeStage = resolveActiveStageForVerifyRecoveryBound({
        askUserRef: verifyResult.askUserRef,
        boundParsedStageIndex: this.boundParsedStageIndex,
        boundStage: this.boundStage,
        checkpointStage: this.activeStage.spec,
        resumeAction,
        yahlStages: this.options.recoveryStages ?? this.stages,
      });

      if (shouldRotateRequestIdForBoundStage(this.stageDocSourceStartLine, this.boundSourceStartLine)) {
        this.requestId = randomUUID();
        this.stageDocSourceStartLine = undefined;
      }

      this.filteredStorage = filterStorageForStage(
        this.storage,
        this.activeStage.lines,
        this.activeStage,
        this.options.loopMeta?.indexName,
      );

      this.resumeStage = undefined;
      this.produceKeysAttempt = 0;
      this.systemAppendParts.push(buildVerifyRecoverySystemAppend({
        failedChecks: verifyResult.failedChecks,
        feedback: verifyResult.feedback,
        produceContextKeys: this.activeStage.produceContextKeys ?? this.activeStage.spec.produceContextKeys,
        resumeAction,
        score: verifyResult.score,
        updateContextKeys: this.activeStage.updateContextKeys ?? this.activeStage.spec.updateContextKeys,
      }));
    }
  }
}

export const runYahl: TRunYahl = (yahl, options) =>
  new YahlAgentRunner(yahl, options).run();
