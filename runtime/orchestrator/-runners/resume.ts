import type { TAskUserResumeFrom, TLoopMeta, TStorage } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { YahlStage } from '@/shared/yahl-stage';

import { runYahl } from '@/orchestrator/-agent';
import { mergeTaskSystemAppend } from '@/orchestrator/-utils/workspace-paths';
import { createStorage } from '@/orchestrator/-tools/set_context';
import { seedDefaultContext } from '@/orchestrator/-context/default-context';
import {
  applyAskUserAnswerToStage,
  fetchAskUserCheckpoint,
  fetchSession,
  fetchStageDetail,
  parsedStageFromSnapshot,
} from '@/orchestrator/-ask-user';
import type { TStageDetailForResume } from '@/orchestrator/-ask-user/session-api';
import { buildResumeFrom } from '@/orchestrator/-ask-user/resume-from';
import { initForkSessionManager } from '@/orchestrator/-runners/fork/manager';
import { compileStage } from '@/orchestrator/-utils/yahl';
import { isStageFinished } from '@/shared/stage-status';

import { runForkSetups } from './fork/setups';

export const resolveForkSuffixFromSetupIndex = (forkSetupIndex?: number) => (
  (forkSetupIndex ?? 0) + 1
);

export const resolveResumeStartIndex = (
  checkpoint: Pick<
    Awaited<ReturnType<typeof fetchAskUserCheckpoint>>,
    'parsedStageSnapshot' | 'stageIndex'
  >,
  yahlStages: ParsedStage[],
) => {
  if (checkpoint.stageIndex != null) {
    return checkpoint.stageIndex;
  }

  if (checkpoint.parsedStageSnapshot) {
    const match = yahlStages.findIndex((stage) =>
      stage.sourceStartLine === checkpoint.parsedStageSnapshot?.sourceStartLine
      && stage.lines === checkpoint.parsedStageSnapshot?.lines);

    if (match >= 0) {
      return match;
    }
  }

  throw new Error('resume: missing stageIndex for non-fork resume');
};

export const buildResumePipelineStages = (
  startIndex: number,
  yahlStages: ParsedStage[],
  resumedStage: ParsedStage,
) => [
  resumedStage,
  ...yahlStages.slice(startIndex + 1),
];

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

  seedDefaultContext(storage);

  return storage;
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

export const buildResumedStage = (
  parsedStage: ParsedStage,
  patchedStage: YahlStage,
) => compileStage(patchedStage, parsedStage.sourceStartLine);

const _resumeAnchorStage = async (params: {
  checkpoint: Awaited<ReturnType<typeof fetchAskUserCheckpoint>>;
  resumedStage: ParsedStage;
  resumeFrom: TAskUserResumeFrom;
  sessionId: string;
  storage: TStorage;
  systemAppend?: string;
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
    systemAppend: params.systemAppend,
    useStorage: () => params.storage,
  });
};

export const runAskUserResume = async (sessionId: string, questionId: string) => {
  console.log(
    `[yahl-diag] ask-user-resume start questionId=${questionId} sessionId=${sessionId} pid=${process.pid}`,
  );

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

  const stageBase = (checkpoint.stage ?? stageDetail.stage) as unknown as YahlStage;
  let patchedStage = stageBase;

  const storage = _deserializeStorage(checkpoint.storageSnapshot);

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
  const systemAppend = await mergeTaskSystemAppend(sessionId, session.taskId);

  if (isFork) {
    await _resumeAnchorStage({
      checkpoint,
      resumedStage,
      resumeFrom,
      sessionId,
      storage,
      systemAppend,
    });

    const manager = await initForkSessionManager(forkSessionId);

    await runForkSetups(manager, storage, {
      fromSetupIndex: resolveForkSuffixFromSetupIndex(checkpoint.forkSetupIndex),
    });
  } else {
    const startIndex = resolveResumeStartIndex(checkpoint, yahlStages);

    if (startIndex < 0 || startIndex >= yahlStages.length) {
      throw new Error(`resume: invalid stageIndex ${startIndex}`);
    }

    const pipelineStages = buildResumePipelineStages(startIndex, yahlStages, resumedStage);

    await runYahl('', {
      pipelineStageIndex: startIndex,
      resumeStage: {
        loopMeta: checkpoint.loopMeta as TLoopMeta | undefined,
        requestId: checkpoint.requestId,
        resumeFrom,
        stage: resumedStage,
      },
      stages: pipelineStages,
      startFromStageIndex: 0,
      systemAppend,
      useStorage: () => storage,
    });
  }

  console.log(
    `[yahl-diag] ask-user-resume end questionId=${questionId} sessionId=${sessionId} pid=${process.pid}`,
  );

  return {
    resultContextKey: session.resultContextKey,
    storage,
  };
};
