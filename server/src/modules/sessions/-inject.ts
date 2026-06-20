import { Repository } from '@/core';

import { Queries } from '@omni-infra/mongoose';

import { modelSession } from './models';
import { createPendingSession } from './use-cases.services/create-pending-session';
import { spawnOrchestrate } from './use-cases/spawn-orchestrate';

Repository.registerCreatePendingSession(createPendingSession);

Repository.registerSpawnOrchestrate(spawnOrchestrate);

Repository.registerValidateSessionById(
  (sessionId) => Queries.hasExactOne(modelSession, { sessionId }),
);
