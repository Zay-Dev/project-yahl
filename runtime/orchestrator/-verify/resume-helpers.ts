import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { YahlStage } from '@/shared/yahl-stage';
import type { TStorage } from '@/shared/transports/-types';

import {
  applyAskUserAnswerToStage,
  resetAskUserStageForRerun,
  stripAskUserAnswersFromContext,
  toAskUserAnswerValue,
} from '@/orchestrator/-ask-user';
import { compileStage } from '@/orchestrator/-utils/yahl';
import { resolveFreshStageForVerifyResume } from '@/orchestrator/-verify/stage-snapshot';

import { buildResumedStage } from '@/orchestrator/-runners/resume';

export type TVerifyResumeAction = 'edit_answer' | 'follow_up' | 'reask' | 'rerun';

export const parsedStagesMatchSlot = (a: ParsedStage, b: ParsedStage) =>
  a.sourceStartLine === b.sourceStartLine;

export const realignActiveStageToBound = (
  boundStage: ParsedStage,
  recoveredStage: ParsedStage,
): ParsedStage =>
  parsedStagesMatchSlot(boundStage, recoveredStage) ? recoveredStage : boundStage;

export const shouldRotateRequestIdForBoundStage = (
  stageDocSourceStartLine: number | undefined,
  boundSourceStartLine: number,
) =>
  stageDocSourceStartLine != null && stageDocSourceStartLine !== boundSourceStartLine;

export const stripProduceKeysFromStorage = (
  storage: TStorage,
  stage: ParsedStage,
) => {
  for (const key of stage.produceContextKeys ?? stage.spec.produceContextKeys ?? []) {
    storage.context.delete(key);
  }
};

export const buildVerifyRecoverySystemAppend = (
  params: {
    failedChecks?: { id: string; reason: string }[];
    feedback: string;
    produceContextKeys?: string[];
    resumeAction: TVerifyResumeAction;
    score: number;
    updateContextKeys?: string[];
  },
) => {
  const parts = [
    `Stage verification failed (score ${params.score}).`,
    params.feedback,
  ];

  if (params.failedChecks?.length) {
    parts.push(
      `Failed checks:\n${params.failedChecks.map((c) => `- ${c.id}: ${c.reason}`).join('\n')}`,
    );
  }

  parts.push(
    'If a check is wrong because of evidence the rubric missed, set_context verify_rebuttal '
    + 'to { checkId, evidence, claim } (at most 2 rebuttals per stage via verify_rebuttal_count) '
    + 'before finishing so the next verifier pass can reconsider that check.',
  );

  if (params.resumeAction === 'rerun') {
    const writeKeys = [
      ...(params.produceContextKeys ?? []),
      ...(params.updateContextKeys ?? []),
    ];
    const uniqueWriteKeys = [...new Set(writeKeys)];

    parts.push(
      uniqueWriteKeys.length > 0
        ? `Re-run this stage and fix the output. Use set_context to write these keys before finishing: ${uniqueWriteKeys.join(', ')}.`
        : 'Re-run this stage and fix the output. Use set_context to write every required context key before finishing.',
    );
  }

  if (params.resumeAction === 'reask' || params.resumeAction === 'follow_up') {
    parts.push(
      'Prior ask-user answers were cleared where needed. Call ask_user with a follow-up batch before producing output.',
    );
  }

  if (params.resumeAction === 'edit_answer') {
    parts.push(
      'The user corrected their prior answer. Re-run stage logic using the updated answer already in context.',
    );
  }

  return parts.filter(Boolean).join('\n\n');
};

export const resolveActiveStageForVerifyRecovery = (params: {
  checkpointStage: YahlStage;
  editedAnswerValue?: number | string | string[];
  askUserRef?: string;
  resumeAction: TVerifyResumeAction;
  stageIndex: number;
  yahlStages: ParsedStage[];
}): ParsedStage => {
  const freshStage = resolveFreshStageForVerifyResume(
    params.stageIndex,
    params.yahlStages,
    params.checkpointStage,
  );

  if (params.resumeAction === 'edit_answer' && params.editedAnswerValue != null && params.askUserRef) {
    const baseStage = freshStage ?? {
      ...params.yahlStages[params.stageIndex]!,
      spec: params.checkpointStage,
    };
    const patchedStage = applyAskUserAnswerToStage(
      baseStage.spec,
      params.askUserRef,
      params.editedAnswerValue,
    );

    return buildResumedStage(baseStage, patchedStage);
  }

  if ((params.resumeAction === 'reask' || params.resumeAction === 'follow_up') && freshStage) {
    const resetSpec = resetAskUserStageForRerun(freshStage.spec);

    return compileStage(resetSpec, freshStage.sourceStartLine);
  }

  if (freshStage) {
    return freshStage;
  }

  const fallback = params.yahlStages[params.stageIndex];

  if (!fallback) {
    throw new Error(
      `verify recovery: stageIndex ${params.stageIndex} out of bounds for ${params.yahlStages.length} stage(s)`,
    );
  }

  return fallback;
};

export const resolveActiveStageForVerifyRecoveryBound = (params: {
  askUserRef?: string;
  boundParsedStageIndex: number;
  boundStage: ParsedStage;
  checkpointStage: YahlStage;
  editedAnswerValue?: number | string | string[];
  resumeAction: TVerifyResumeAction;
  yahlStages: ParsedStage[];
}): ParsedStage => {
  const recoveredStage = resolveActiveStageForVerifyRecovery({
    askUserRef: params.askUserRef,
    checkpointStage: params.checkpointStage,
    editedAnswerValue: params.editedAnswerValue,
    resumeAction: params.resumeAction,
    stageIndex: params.boundParsedStageIndex,
    yahlStages: params.yahlStages,
  });

  return realignActiveStageToBound(params.boundStage, recoveredStage);
};

export const applyVerifyRecoveryToStorage = (params: {
  askUserRef?: string;
  editedAnswerValue?: number | string | string[];
  failedChecks?: { id: string; reason: string }[];
  feedback: string;
  resumeAction: TVerifyResumeAction;
  storage: TStorage;
}) => {
  if (params.resumeAction === 'reask' || params.resumeAction === 'follow_up') {
    const stripped = stripAskUserAnswersFromContext({
      context: Object.fromEntries(params.storage.context.entries()),
      types: Object.fromEntries(params.storage.types.entries()),
    }) as { context?: Record<string, unknown>; types?: Record<string, unknown> };

    if (stripped.context) {
      params.storage.context.clear();
      Object.entries(stripped.context).forEach(([key, value]) => {
        params.storage.context.set(key, value);
      });
    }
  }

  params.storage.context.set('verify_feedback', params.feedback);
  params.storage.context.set(
    'verify_failed_checks',
    params.failedChecks?.length ? params.failedChecks : [],
  );
  params.storage.context.delete('verify_rebuttal');

  if (params.resumeAction === 'edit_answer' && params.editedAnswerValue != null && params.askUserRef) {
    const answerKey = `ask_user_${params.askUserRef}_answer`;

    params.storage.context.set(answerKey, params.editedAnswerValue);
    params.storage.context.set('ask_user_last_answer', params.editedAnswerValue);
  }
};

export const resolveEditedAnswerValue = (params: {
  editedAnswerFreeText?: string;
  editedAnswerOptionIds?: string[];
}) => {
  if (params.editedAnswerFreeText?.trim()) {
    return params.editedAnswerFreeText.trim();
  }

  return toAskUserAnswerValue(params.editedAnswerOptionIds?.[0]);
};

export const verifyAutoRetryMaxIterations = () => {
  const raw = Number(process.env.YAHL_VERIFY_AUTO_RETRY_MAX ?? 8);

  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 8;
};
