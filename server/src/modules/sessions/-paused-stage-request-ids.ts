import { Queries } from '@omni-infra/mongoose';

import { modelAskUserQuestion, modelUserPauseCheckpoint, modelVerifyCheckpoint } from './models';

export const resolvePausedStageRequestIds = async (sessionRef: string) => {
  const [verifyRows, askUserRows, userPauseRows] = await Promise.all([
    Queries.queryBy(modelVerifyCheckpoint, {
      session: sessionRef,
      status: 'pending',
    }).select('requestId').lean(),
    Queries.queryBy(modelAskUserQuestion, {
      session: sessionRef,
      status: 'pending',
    }).select('requestId').lean(),
    Queries.queryBy(modelUserPauseCheckpoint, {
      session: sessionRef,
      status: 'pending',
    }).select('requestId').lean(),
  ]);

  return new Set([
    ...verifyRows.map((row) => row.requestId),
    ...askUserRows.map((row) => row.requestId),
    ...userPauseRows.map((row) => row.requestId),
  ]);
};
