import type { TChatToolCall, TLoopMeta, TStorage } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/orchestrator-types';
import type { YahlStage } from '@/shared/yahl-stage';

import { composeDown } from '@/orchestrator/compose-onecli';
import { parseAskUserToolArguments } from '@/shared/stage-tools';

import { AskUserPausedError } from './errors';
import { resolveAskUserEntry, validateAskUserToolCall } from './registry';
import { postAskUserQuestion } from './session-api';
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

  const args = parseAskUserToolArguments(params.toolCall.function.arguments ?? '');

  if (!args) {
    return { hasError: true, result: 'ask_user: invalid arguments' };
  }

  const validationError = validateAskUserToolCall(params.stage.spec, args);

  if (validationError) {
    return { hasError: true, result: validationError };
  }

  const questionRef = args.questionRef.trim();
  const entry = resolveAskUserEntry(params.stage.spec, questionRef);

  if (entry?.answer !== undefined) {
    return { hasError: true, result: 'ask_user: question already answered' };
  }

  if (!entry) {
    return { hasError: true, result: `ask_user: unknown questionRef "${questionRef}"` };
  }

  await globalThis.sessionTracker?.flush?.();

  await postAskUserQuestion(params.sessionId, {
    askUserId: entry.id,
    contextSnapshot: _serializeContextSnapshot(params.storage),
    forkSetupIndex: params.forkSetupIndex,
    loopMeta: params.loopMeta,
    parsedStageSnapshot: toParsedStageSnapshot(params.stage),
    question: args,
    questionRef,
    requestId: params.requestId,
    stage: params.stage.spec as unknown as Record<string, unknown>,
    ...(params.stageIndex === undefined ? {} : { stageIndex: params.stageIndex }),
    storageSnapshot: _serializeStorage(params.storage),
    toolCallId: params.toolCall.id,
  });

  await globalThis.sessionTracker?.flush?.();

  params.onPause();
  await composeDown(params.agentName);

  throw new AskUserPausedError();
};

export const applyAskUserAnswerToStage = (
  stage: YahlStage,
  questionRef: string,
  answerValue: number | string,
) => {
  const trimmed = questionRef.trim();
  const entry = stage.askUser?.find((item) => item.id === trimmed);

  if (!entry) {
    return stage;
  }

  return {
    ...stage,
    askUser: stage.askUser?.map((item) => (
      item.id === trimmed
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
export { parsedStageFromSnapshot, toParsedStageSnapshot } from './parsed-stage-snapshot';
export type { TParsedStageSnapshot } from './parsed-stage-snapshot';
export {
  listAskUserRefs,
  resolveAskUserEntry,
  validateAskUserToolCall,
} from './registry';
