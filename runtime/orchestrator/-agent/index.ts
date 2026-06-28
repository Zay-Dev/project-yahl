import { randomUUID } from 'crypto';

import type { TResumeStage, TRunYahl } from './-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { TStorage } from '@/shared/transports/-types';

import { toAgentStage } from '@/shared/yahl-stage';

import { parseYahlDocument, parseYahlFile } from '@/orchestrator/-utils/yahl';
import { createStorage } from '@/orchestrator/-tools/set_context';
import { seedRunInputContext } from '@/orchestrator/-context/default-context';

import { resolveEffectiveStageTemperature } from '@/orchestrator/-utils/yahl/stage-parse';
import { AskUserPausedError, handleAskUserToolCall } from '@/orchestrator/-ask-user';
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

import { archiveStagePlan, prepareStagePlan } from './plan-mode';
import {
  buildProduceKeysSystemAppend,
  missingProduceKeys,
  pauseForProduceKeys,
  produceKeysMaxRetries,
  writeProduceKeysDiagnostic,
} from './produce-keys-retry';
import { handleLoop } from './loop';

const AGENT_LOCAL_TOOLS = new Set(['browser', 'mastermind', 'run_bash']);

type TRunYahlOptions = NonNullable<Parameters<TRunYahl>[1]>;

type TProduceKeysRetryOutcome = 'break' | 'continue';

class YahlAgentRunner {
  private readonly storage: TStorage;

  private readonly stages: ParsedStage[];

  private readonly startIndex: number;

  private readonly sessionId: string;

  private readonly agentName: string;

  private readonly maxProduceKeysRetries = produceKeysMaxRetries();

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

  constructor(
    yahl: string,
    {
      useStorage = () => createStorage(),
      ...options
    }: TRunYahlOptions = {},
  ) {
    this.storage = useStorage();
    seedRunInputContext(
      this.storage,
      options.runInput,
      parseYahlDocument(yahl).runInput,
    );
    this.options = options;
    this.startIndex = options.startFromStageIndex ?? 0;
    this.stages = options.stages ?? parseYahlFile(yahl);
    this.sessionId = globalThis.sessionId;
    this.agentName = `agent-${this.sessionId}`;
  }

  async run() {
    for (let stageIndex = this.startIndex; stageIndex < this.stages.length; stageIndex += 1) {
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
        await handleLoop(
          stage,
          this.storage,
          runYahl,
          this.temperature,
          this.pipelineStageIndex,
        );
        continue;
      }

      this.resetStageContext(stage, stageIndex, isResumingThisStage);
      await this.runOneStage();
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

    this.boundParsedStageIndex = parsedStageIndex;
    this.boundStage = stage;
    this.boundSourceStartLine = stage.sourceStartLine;
    this.stageDocSourceStartLine = undefined;

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
  }

  private async withPlanMode(run: () => Promise<void>) {
    if (!this.resumeStage && this.activeStage.spec.planMode === true) {
      const planAppend = await prepareStagePlan({
        requestId: this.requestId,
        sessionId: this.sessionId,
        stage: this.activeStage,
        storage: this.filteredStorage,
      });

      if (planAppend) {
        this.systemAppendParts.push(planAppend);
      }
    }

    await run();

    if (this.activeStage.spec.planMode === true) {
      await archiveStagePlan(this.sessionId, this.requestId);
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

      if (this.systemAppendParts.length > 0) {
        this.systemAppendParts.length = 1;
        this.systemAppendParts[0] = this.systemAppendParts[0]!;
      } else {
        this.systemAppendParts.length = 0;
      }

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
          const applied = await applySetContextToolCall(
            this.storage,
            toolCall,
            this.activeStage,
          );

          return {
            hasError: false,
            result: applied ? 'OK' : 'skipped',
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

    console.log(`[orchestrator] stage wait start requestId=${this.requestId}`);
    console.log(
      `[yahl-diag] race start requestId=${this.requestId} resumeStage=${Boolean(this.options.resumeStage)} pid=${process.pid}`,
    );

    try {
      await Promise.race([wait(), pausePromise]);
    } catch (error) {
      disposeWait();
      toolCallHandlers.dispose();
      await toolCallPromise.catch(() => {});

      const errorName = error instanceof Error ? error.name : 'unknown';

      console.log(
        `[orchestrator] stage wait end requestId=${this.requestId} durationMs=${Date.now() - waitStartedAt} outcome=error`,
      );
      console.log(
        `[yahl-diag] race error requestId=${this.requestId} errorName=${errorName} pid=${process.pid}`,
      );

      if (error instanceof AskUserPausedError) {
        throw error;
      }

      throw error;
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

  private async runOneStage() {
    const maxVerifyRetries = verifyAutoRetryMaxIterations();
    const verifyAutoRetry = this.activeStage.spec.verifyAutoRetry === true;

    while (true) {
      await this.withPlanMode(async () => {
        while (true) {
          await this.runStageAttempt();

          if ((await this.resolveProduceKeysRetry()) === 'break') {
            break;
          }
        }
      });

      const finishContextAfter = this.options.contextAfterRecord ?? this.storage;

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
        return;
      }

      if (!verifyAutoRetry || this.verifyRetryAttempt >= maxVerifyRetries) {
        return;
      }

      if (!isVerifyRubricFailure(verifyResult)) {
        return;
      }

      this.verifyRetryAttempt += 1;

      const resumeAction = verifyResult.resumeAction ?? 'rerun';

      applyVerifyRecoveryToStorage({
        askUserRef: verifyResult.askUserRef,
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
        yahlStages: this.stages,
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
