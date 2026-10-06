import { Repository } from '@/core';

import { Queries } from '@omni-infra/mongoose';

import { modelSession } from './models';
import { countActiveSessionRuns } from './use-cases.services/count-active-session-runs';
import { createPendingSession } from './use-cases.services/create-pending-session';
import { sumUsageSince } from './use-cases.services/sum-usage-since';
import { spawnOrchestrate } from './use-cases/spawn-orchestrate';

Repository.registerCreatePendingSession(createPendingSession);

Repository.registerSpawnOrchestrate(spawnOrchestrate);

Repository.registerSumUsageSince(sumUsageSince);

Repository.registerValidateSessionById(
  (sessionId) => Queries.hasExactOne(modelSession, { sessionId }),
);

Repository.registerCountActiveSessionRuns(countActiveSessionRuns);
