import type {
  TResponseGetSession,
  TResponseStageListItem,
  TResponseVerifyCheckpoint,
} from '@project-yahl/server/modules/sessions/-api-types';

import { isVerifyInfraFeedback } from '@/pages/sessions/hooks/is-verify-infra-feedback';

export type TVerifyBannerState =
  | { checkpoint: TResponseVerifyCheckpoint; mode: 'auto_retry' }
  | { checkpoint: TResponseVerifyCheckpoint; mode: 'infra_busy' }
  | { checkpoint: TResponseVerifyCheckpoint; mode: 'manual' };

const isSessionRunActive = (session: Pick<TResponseGetSession, 'liveViewVncPort'>) =>
  typeof session.liveViewVncPort === 'number' && session.liveViewVncPort > 0;

const isInfraCheckpoint = (checkpoint: TResponseVerifyCheckpoint) =>
  checkpoint.unavailable === true || isVerifyInfraFeedback(checkpoint.feedback);

const isOpenStageStatus = (status: TResponseStageListItem['status']) =>
  status === 'running' || status === 'verifying';

export const resolveVerifyBannerState = (
  pendingCheckpoints: TResponseVerifyCheckpoint[],
  stages: TResponseStageListItem[],
  session: Pick<TResponseGetSession, 'liveViewVncPort'>,
): TVerifyBannerState | null => {
  const openStage = stages.find((stage) => isOpenStageStatus(stage.status));
  const verifyingStage = stages.find((stage) => stage.status === 'verifying');

  if (verifyingStage) {
    return null;
  }

  const actionable = pendingCheckpoints.filter((checkpoint) => {
    const stage = stages.find((item) => item.requestId === checkpoint.requestId);

    return stage?.status !== 'finished';
  });

  const checkpoint = actionable[0];

  if (!checkpoint) {
    return null;
  }

  if (isInfraCheckpoint(checkpoint)) {
    return { checkpoint, mode: 'infra_busy' };
  }

  if (openStage?.requestId === checkpoint.requestId) {
    return isSessionRunActive(session)
      ? { checkpoint, mode: 'auto_retry' }
      : { checkpoint, mode: 'manual' };
  }

  if (openStage && openStage.requestId !== checkpoint.requestId) {
    return null;
  }

  if (isSessionRunActive(session)) {
    return null;
  }

  return { checkpoint, mode: 'manual' };
};
