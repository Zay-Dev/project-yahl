import type { TChatToolCall, TLoopMeta, TStorage } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { YahlStage } from '@/shared/yahl-stage';

import { shutdownAgent } from '@/orchestrator/-docker';
import { explainAskUserBatchParseFailure } from '@/shared/ask-user-batch';
import { parseAskUserToolArguments } from '@/shared/stage-tools';

import { AskUserPausedError } from './errors';
import { mergeBatchIntoStage, validateAskUserToolCall } from './registry';
import { postAskUserBatch } from './session-api';
import { toParsedStageSnapshot } from './parsed-stage-snapshot';

const askUserEnabled = process.env.YAHL_ENABLE_ASK_USER !== 'false';

const _serializeStorage = (storage: TStorage) => ({
  context: Object.fromEntries(storage.context.entries()),
  types: Object.fromEntries(storage.types.entries()),
});

const _serializeContextSnapshot = (storage: TStorage) => ({
  context: Object.fromEntries(storage.context.entries()),
  stage: {},
  types: Object.fromEntries(storage.types.entries()),
});

export const handleAskUserToolCall = async (params: {
  agentName: string;
  forkSetupIndex?: number;
  loopMeta?: TLoopMeta;
  onPause: () => void;
  requestId: string;
  sessionId: string;
  stage: ParsedStage;
  stageIndex?: number;
  storage: TStorage;
  toolCall: TChatToolCall;
}) => {
  if (!askUserEnabled) {
    return { hasError: true, result: 'ask_user is disabled' };
  }

  const rawArgs = params.toolCall.function.arguments ?? '';
  const args = parseAskUserToolArguments(rawArgs);

  if (!args) {
    return { hasError: true, result: explainAskUserBatchParseFailure(rawArgs) };
  }

  const validationError = validateAskUserToolCall(params.stage.spec, args);

  if (validationError) {
    return { hasError: true, result: validationError };
  }

  const mergedStage = mergeBatchIntoStage(params.stage.spec, args);

  await globalThis.sessionTracker?.flush?.();

  await postAskUserBatch(params.sessionId, {
    batch: args,
    batchId: args.batchId,
    contextSnapshot: _serializeContextSnapshot(params.storage),
    forkSetupIndex: params.forkSetupIndex,
    loopMeta: params.loopMeta,
    parsedStageSnapshot: toParsedStageSnapshot(params.stage),
    requestId: params.requestId,
    stage: mergedStage as unknown as Record<string, unknown>,
    ...(params.stageIndex === undefined ? {} : { stageIndex: params.stageIndex }),
    storageSnapshot: _serializeStorage(params.storage),
    toolCallId: params.toolCall.id,
  });

  await globalThis.sessionTracker?.flush?.();

  console.log(
    `[yahl-diag] ask-user pause requestId=${params.requestId} sessionId=${params.sessionId} pid=${process.pid}`,
  );

  params.onPause();
  await shutdownAgent(params.agentName, params.sessionId);

  throw new AskUserPausedError();
};

export const applyAskUserAnswerToStage = (
  stage: YahlStage,
  questionRef: string,
  answerValue: number | string | string[],
) => {
  const trimmed = questionRef.trim();
  const entry = stage.askUser?.find((item) => String(item.id) === trimmed);

  if (!entry) {
    return stage;
  }

  return {
    ...stage,
    askUser: stage.askUser?.map((item) => (
      String(item.id) === trimmed
        ? { ...item, answer: answerValue }
        : item
    )),
  };
};

export { AskUserPausedError } from './errors';
export {
  buildAskUserContinuation,
  extractAskUserRefsFromLogic,
  toAskUserAnswerValue,
} from './continuation';
export { buildResumeFrom } from './resume-from';
export {
  resetAskUserStageForRerun,
  stripAskUserAnswersFromContext,
} from './reset-for-rerun';
export { fetchAskUserCheckpoint, fetchSession, fetchStageDetail } from './session-api';
export type { TSessionFetch } from './session-api';
export { parsedStageFromSnapshot, toParsedStageSnapshot } from './parsed-stage-snapshot';
export type { TParsedStageSnapshot } from './parsed-stage-snapshot';
export {
  listAskUserRefs,
  mergeBatchIntoStage,
  resolveAskUserEntry,
  validateAskUserToolCall,
} from './registry';
