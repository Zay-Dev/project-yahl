import { Repository } from '@/core';

import { Queries } from '@omni-infra/mongoose';

import { modelSession } from './models';

Repository.registerValidateSessionById(
  (sessionId) => Queries.hasExactOne(modelSession, { sessionId }),
);
