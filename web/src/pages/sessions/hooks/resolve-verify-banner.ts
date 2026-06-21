import type {
  TResponseGetSession,
  TResponseStageListItem,
  TResponseVerifyCheckpoint,
} from '@project-yahl/server/modules/sessions/-api-types';

export type TVerifyBannerState =
  | { checkpoint: TResponseVerifyCheckpoint; mode: 'auto_retry' }
  | { checkpoint: TResponseVerifyCheckpoint; mode: 'manual' };

const isSessionRunActive = (session: Pick<TResponseGetSession, 'liveViewVncPort'>) =>
  typeof session.liveViewVncPort === 'number' && session.liveViewVncPort > 0;

export const resolveVerifyBannerState = (
  pendingCheckpoints: TResponseVerifyCheckpoint[],
  stages: TResponseStageListItem[],
  session: Pick<TResponseGetSession, 'liveViewVncPort'>,
): TVerifyBannerState | null => {
  const openStage = stages.find((stage) => stage.status === 'running');
  const actionable = pendingCheckpoints.filter((checkpoint) => {
    const stage = stages.find((item) => item.requestId === checkpoint.requestId);

    return stage?.status !== 'finished';
  });

  const checkpoint = actionable[0];

  if (!checkpoint) {
    return null;
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
