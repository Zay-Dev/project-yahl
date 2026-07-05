import { Queries } from '@omni-infra/mongoose';

import { modelAskUserQuestion, modelVerifyCheckpoint } from './models';

export const resolvePausedStageRequestIds = async (sessionRef: string) => {
  const [verifyRows, askUserRows] = await Promise.all([
    Queries.queryBy(modelVerifyCheckpoint, {
      session: sessionRef,
      status: 'pending',
    }).select('requestId').lean(),
    Queries.queryBy(modelAskUserQuestion, {
      session: sessionRef,
      status: 'pending',
    }).select('requestId').lean(),
  ]);

  return new Set([
    ...verifyRows.map((row) => row.requestId),
    ...askUserRows.map((row) => row.requestId),
  ]);
};
