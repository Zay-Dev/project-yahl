import type { TAskUserResumeFrom, TLoopMeta, TStorage } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/orchestrator-types';
import type { YahlStage } from '@/shared/yahl-stage';

import { runYahl } from '@/orchestrator/-agent';
import { createStorage } from '@/orchestrator/-tools/set_context';
import {
  applyAskUserAnswerToStage,
  buildAskUserContinuation,
  fetchAskUserCheckpoint,
  fetchSession,
  fetchStageDetail,
  parsedStageFromSnapshot,
  toAskUserAnswerValue,
} from '@/orchestrator/-ask-user';
import type { TStageDetailForResume } from '@/orchestrator/-ask-user/session-api';
import { buildResumeFrom } from '@/orchestrator/-ask-user/resume-from';
import { initForkSessionManager } from '@/orchestrator/fork-session-manager';
import { compileStage } from '@/orchestrator/yahl-parse';
import { isStageFinished } from '@/shared/stage-status';

import { runForkSetups } from './fork-setups';

export const resolveForkSuffixFromSetupIndex = (forkSetupIndex?: number) => (
  (forkSetupIndex ?? 0) + 1
);

const _deserializeStorage = (snapshot: Record<string, unknown>): TStorage => {
  const context = snapshot.context;
  const types = snapshot.types;

  const storage = createStorage();

  if (context && typeof context === 'object' && !Array.isArray(context)) {
    Object.entries(context).forEach(([key, value]) => {
      storage.context.set(key, value);
    });
  }

  if (types && typeof types === 'object' && !Array.isArray(types)) {
    Object.entries(types).forEach(([key, value]) => {
      storage.types.set(key, value);
    });
  }

  return storage;
};

const _resolveAnswerValue = (checkpoint: Awaited<ReturnType<typeof fetchAskUserCheckpoint>>) => {
  if (checkpoint.freeText?.trim()) {
    return checkpoint.freeText.trim();
  }

  return toAskUserAnswerValue(checkpoint.answerIds?.[0]);
};

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

const _buildResumedStage = (
  parsedStage: ParsedStage,
  patchedStage: YahlStage,
  questionRef: string,
  answerValue: number | string,
) => {
  const continuationSources = [
    patchedStage.logic,
    parsedStage.spec.logic,
    parsedStage.lines,
  ].filter((source, index, all) => source && all.indexOf(source) === index);

  for (const source of continuationSources) {
    const continuation = buildAskUserContinuation(source, questionRef, answerValue);

    if (!continuation) {
      continue;
    }

    const spec = {
      ...patchedStage,
      logic: continuation.stageText,
    };

    return compileStage(spec, parsedStage.sourceStartLine);
  }

  return {
    ...parsedStage,
    spec: patchedStage,
  };
};

const _resumeAnchorStage = async (params: {
  checkpoint: Awaited<ReturnType<typeof fetchAskUserCheckpoint>>;
  resumedStage: ParsedStage;
  resumeFrom: TAskUserResumeFrom;
  storage: TStorage;
}) => {
  await runYahl('', {
    resumeStage: {
      loopMeta: params.checkpoint.loopMeta as TLoopMeta | undefined,
      requestId: params.checkpoint.requestId,
      resumeFrom: params.resumeFrom,
      stage: params.resumedStage,
    },
    stages: [params.resumedStage],
    startFromStageIndex: 0,
    useStorage: () => params.storage,
  });
};

export const runAskUserResume = async (sessionId: string, questionId: string) => {
  const checkpoint = await fetchAskUserCheckpoint(sessionId, questionId);

  if (checkpoint.status !== 'answered') {
    throw new Error(`resume: question ${questionId} is not answered`);
  }

  const stageDetail = await fetchStageDetail(sessionId, checkpoint.requestId);

  if (isStageFinished(stageDetail)) {
    throw new Error('resume: stage already finished');
  }

  const session = await fetchSession(sessionId);
  const yahlStages = session.parsedStages ?? [];
  const forkSessionId = session.forkedFrom?.forkSessionId;
  const isFork = forkSessionId != null;

  if (!isFork && !yahlStages.length) {
    throw new Error('resume: session missing parsedStages');
  }

  const answerValue = _resolveAnswerValue(checkpoint);
  const stageBase = (checkpoint.stage ?? stageDetail.stage) as unknown as YahlStage;
  const patchedStage = applyAskUserAnswerToStage(
    stageBase,
    checkpoint.questionRef,
    answerValue,
  );

  const storage = _deserializeStorage(checkpoint.storageSnapshot);
  const answerKey = `ask_user_${checkpoint.askUserId}_answer`;

  storage.context.set(answerKey, answerValue);
  storage.context.set('ask_user_last_answer', answerValue);

  const resumeFrom = buildResumeFrom(checkpoint, stageDetail as TStageDetailForResume);
  const baseParsed = _resolveBaseParsed(checkpoint, yahlStages);
  const resumedStage = _buildResumedStage(
    baseParsed,
    patchedStage,
    checkpoint.questionRef,
    answerValue,
  );

  if (isFork) {
    await _resumeAnchorStage({
      checkpoint,
      resumedStage,
      resumeFrom,
      storage,
    });

    const manager = await initForkSessionManager(forkSessionId);

    await runForkSetups(manager, storage, {
      fromSetupIndex: resolveForkSuffixFromSetupIndex(checkpoint.forkSetupIndex),
    });

    return;
  }

  const startIndex = checkpoint.stageIndex;

  if (startIndex == null) {
    throw new Error('resume: missing stageIndex for non-fork resume');
  }

  if (startIndex < 0 || startIndex >= yahlStages.length) {
    throw new Error(`resume: invalid stageIndex ${startIndex}`);
  }

  await runYahl('', {
    resumeStage: {
      loopMeta: checkpoint.loopMeta as TLoopMeta | undefined,
      requestId: checkpoint.requestId,
      resumeFrom,
      stage: resumedStage,
    },
    stages: yahlStages,
    startFromStageIndex: startIndex,
    useStorage: () => storage,
  });
};
