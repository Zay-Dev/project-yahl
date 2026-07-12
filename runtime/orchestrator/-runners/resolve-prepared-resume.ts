import type { TLoopMeta } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { YahlStage } from '@/shared/yahl-stage';
import type { TPreparedRunInput } from './prepared-run-types';
import {
  applyAskUserAnswerToStage,
  fetchAskUserCheckpoint,
  fetchSession,
  fetchStageDetail,
  parsedStageFromSnapshot,
} from '@/orchestrator/-ask-user';
import type { TStageDetailForResume } from '@/orchestrator/-ask-user/session-api';

import { buildResumeFrom } from '@/orchestrator/-ask-user/resume-from';
import { isStageFinished } from '@/shared/stage-status';
import {
  applyVerifyRecoveryToStorage,
  buildVerifyRecoverySystemAppend,
  resolveActiveStageForVerifyRecovery,
  resolveEditedAnswerValue,
  stripProduceKeysFromStorage,
} from '@/orchestrator/-verify/resume-helpers';

import { deserializeCheckpointStorage, loadCheckpointResumeContext } from './checkpoint-resume-load';
import {
  buildResumedStage,
  resolveResumeStartIndex,
} from './resume';

export type TResumeKind = 'ask-user' | 'produce-keys' | 'verify';

const _resolveBaseParsed = (
  checkpoint: Awaited<ReturnType<typeof fetchAskUserCheckpoint>>,
  yahlStages: ParsedStage[],
): ParsedStage => {
  const stageBase = checkpoint.stage as unknown as YahlStage;

  if (checkpoint.parsedStageSnapshot) {
    return parsedStageFromSnapshot(stageBase, checkpoint.parsedStageSnapshot);
  }

  const startIndex = checkpoint.stageIndex;

  if (startIndex == null) {
    throw new Error('resume: missing parsedStageSnapshot and stageIndex');
  }

  if (startIndex < 0 || startIndex >= yahlStages.length) {
    throw new Error(`resume: invalid stageIndex ${startIndex}`);
  }

  return yahlStages[startIndex]!;
};

const _resolveAskUserPrepared = async (
  sessionId: string,
  questionId: string,
): Promise<TPreparedRunInput> => {
  const checkpoint = await fetchAskUserCheckpoint(sessionId, questionId);

  if (checkpoint.status !== 'answered') {
    throw new Error(`resume: question ${questionId} is not answered`);
  }

  const stageDetail = await fetchStageDetail(sessionId, checkpoint.requestId);

  if (isStageFinished(stageDetail)) {
    throw new Error('resume: stage already finished');
  }

  const session = await fetchSession(sessionId);
  const yahlStages = session.parsedStages;

  if (!yahlStages.length) {
    throw new Error('resume: session missing parsedStages');
  }

  const stageBase = (checkpoint.stage ?? stageDetail.stage) as unknown as YahlStage;
  let patchedStage = stageBase;
  const storage = deserializeCheckpointStorage(checkpoint.storageSnapshot);

  for (const answer of checkpoint.batchAnswers ?? []) {
    patchedStage = applyAskUserAnswerToStage(
      patchedStage,
      answer.questionRef,
      answer.answerValue,
    );

    storage.context.set(`ask_user_${answer.questionRef}_answer`, answer.answerValue);
  }

  if ((checkpoint.batchAnswers ?? []).length > 0) {
    const last = checkpoint.batchAnswers!.at(-1)!;
    storage.context.set('ask_user_last_answer', last.answerValue);
  }

  const resumeFrom = buildResumeFrom(checkpoint, stageDetail as TStageDetailForResume);
  const baseParsed = _resolveBaseParsed(checkpoint, yahlStages);
  const resumedStage = buildResumedStage(baseParsed, patchedStage);
  const startIndex = resolveResumeStartIndex(checkpoint, yahlStages);
  const loopMeta = checkpoint.loopMeta as TLoopMeta | undefined;

  if (startIndex < 0 || startIndex >= yahlStages.length) {
    throw new Error(`resume: invalid stageIndex ${startIndex}`);
  }

  return {
    cursor: {
      kind: 'pipeline',
      loopMeta,
      resumeStage: {
        loopMeta,
        requestId: checkpoint.requestId,
        resumeFrom,
        stage: resumedStage,
      },
      stageIndex: startIndex,
    },
    parsedStages: yahlStages,
    resultContextKey: session.resultContextKey ?? 'result',
    storage,
    taskYahl: session.taskYahl,
  };
};

const _resolveProduceKeysPrepared = async (
  sessionId: string,
  verifyId: string,
): Promise<TPreparedRunInput> => {
  const {
    activeStage,
    checkpoint,
    session,
    stageIndex,
    storage,
    yahlStages,
  } = await loadCheckpointResumeContext(sessionId, verifyId);

  const feedback = String(checkpoint.feedback ?? '');
  const requestId = String(checkpoint.requestId ?? '');
  const produceKeysAppend = [
    'The stage previously failed to produce required context keys.',
    feedback,
    'Use set_context to write every missing produceContextKeys value before finishing.',
  ].join('\n\n');

  return {
    cursor: {
      kind: 'pipeline',
      produceKeysResumeAttempt: true,
      resumeStage: {
        requestId,
        stage: activeStage,
      },
      stageIndex,
    },
    parsedStages: yahlStages,
    resultContextKey: session.resultContextKey ?? 'result',
    storage,
    systemAppend: produceKeysAppend,
    taskYahl: session.taskYahl,
  };
};

const _resolveResumeAction = (
  checkpoint: Awaited<ReturnType<typeof loadCheckpointResumeContext>>['checkpoint'],
) => {
  if (checkpoint.editedAnswerFreeText?.trim() || checkpoint.editedAnswerOptionIds?.length) {
    return 'edit_answer' as const;
  }

  if (
    checkpoint.resumeAction === 'edit_answer'
    || checkpoint.resumeAction === 'follow_up'
    || checkpoint.resumeAction === 'reask'
    || checkpoint.resumeAction === 'rerun'
  ) {
    return checkpoint.resumeAction;
  }

  return 'rerun' as const;
};

const _resolveVerifyPrepared = async (
  sessionId: string,
  verifyId: string,
  baseSystemAppend?: string,
): Promise<TPreparedRunInput> => {
  const {
    activeStage,
    checkpoint,
    session,
    stageIndex,
    storage,
    yahlStages,
  } = await loadCheckpointResumeContext(sessionId, verifyId);

  const withBaseAppend = async (extra?: string) => extra;

  if (checkpoint.unavailable) {
    const requestId = String(checkpoint.requestId);
    const hasProducedKeys = (activeStage.spec.produceContextKeys ?? []).length > 0
      && (activeStage.spec.produceContextKeys ?? []).every((key) => {
        const value = storage.context.get(key);

        return value !== undefined && value !== null;
      });

    return {
      cursor: {
        kind: 'pipeline',
        resumeStage: {
          requestId,
          stage: activeStage,
        },
        stageIndex,
        verifyWasUnavailable: true,
        verifyWasUnavailableWithProducedKeys: hasProducedKeys,
      },
      parsedStages: yahlStages,
      resultContextKey: session.resultContextKey ?? 'result',
      storage,
      systemAppend: await withBaseAppend(),
      taskYahl: session.taskYahl,
    };
  }

  const resumeAction = _resolveResumeAction(checkpoint);
  const feedback = String(checkpoint.feedback ?? '');
  const requestId = String(checkpoint.requestId ?? '');
  const askUserRef = String(checkpoint.askUserRef ?? '').trim();
  const editedAnswerValue = resumeAction === 'edit_answer'
    ? resolveEditedAnswerValue({
      editedAnswerFreeText: checkpoint.editedAnswerFreeText,
      editedAnswerOptionIds: checkpoint.editedAnswerOptionIds,
    })
    : undefined;

  applyVerifyRecoveryToStorage({
    askUserRef,
    editedAnswerValue,
    feedback,
    resumeAction,
    storage,
  });

  const recoveryStage = resolveActiveStageForVerifyRecovery({
    askUserRef,
    checkpointStage: checkpoint.stage,
    editedAnswerValue,
    resumeAction,
    stageIndex,
    yahlStages,
  });

  stripProduceKeysFromStorage(storage, recoveryStage);

  const stageDetail = await fetchStageDetail(sessionId, requestId);
  const loopMeta = stageDetail.loopMeta as TLoopMeta | undefined;

  return {
    cursor: {
      kind: 'pipeline',
      loopMeta,
      resumeStage: {
        loopMeta,
        requestId,
        stage: recoveryStage,
      },
      stageIndex,
    },
    parsedStages: yahlStages,
    resultContextKey: session.resultContextKey ?? 'result',
    storage,
    systemAppend: await withBaseAppend(
      buildVerifyRecoverySystemAppend({
        feedback,
        produceContextKeys: recoveryStage.produceContextKeys ?? recoveryStage.spec.produceContextKeys,
        resumeAction,
        score: checkpoint.score,
        updateContextKeys: recoveryStage.updateContextKeys ?? recoveryStage.spec.updateContextKeys,
      }),
    ),
    taskYahl: session.taskYahl,
  };
};

export const resolvePreparedResumeRun = async (
  sessionId: string,
  resumeId: string,
  kind: TResumeKind,
  options?: { systemAppend?: string },
): Promise<TPreparedRunInput> => {
  if (kind === 'ask-user') {
    return _resolveAskUserPrepared(sessionId, resumeId);
  }

  if (kind === 'produce-keys') {
    const prepared = await _resolveProduceKeysPrepared(sessionId, resumeId);

    if (options?.systemAppend) {
      prepared.systemAppend = `${options.systemAppend}\n\n${prepared.systemAppend ?? ''}`;
    }

    return prepared;
  }

  const prepared = await _resolveVerifyPrepared(sessionId, resumeId, options?.systemAppend);

  return prepared;
};
