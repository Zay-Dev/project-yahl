import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';
import { Queries } from '@omni-infra/mongoose';

import type { TResponseGetForkSession } from '../-api-types';
import { resolveSessionBySessionId } from '../-resolve-session';
import { modelForkSession } from '../models';

export type TRequestForkSessionParams = {
  forkSessionId: string;
};

const paramsSchema = Joi.object<TRequestForkSessionParams>({
  forkSessionId: Joi.string().trim().required(),
});

export const getForkSession = [
  Middlewares.Chainable
    .validate(({ req }) => joi.getValidatedOrThrow(paramsSchema, req.params))
    .next(async (express, params) => {
      const forkSession = await Queries.hasExactOne(modelForkSession, {
        forkSessionId: params.forkSessionId,
      });

      const sourceSession = await resolveSessionBySessionId(forkSession.sourceSessionId);
      const targetSession = await resolveSessionBySessionId(forkSession.targetSessionId);

      const response: TResponseGetForkSession = {
        anchorStageId: forkSession.anchorStageId,
        forkSessionId: forkSession.forkSessionId,
        parsedStages: targetSession.parsedStages,
        setups: forkSession.setups,
        resultContextKey: targetSession.resultContextKey ?? sourceSession.resultContextKey,
        sourceSessionId: forkSession.sourceSessionId,
        targetSessionId: forkSession.targetSessionId,
        taskYahlPath: sourceSession.taskYahlPath,
      };

      express.respondOne<TResponseGetForkSession>(response);
    })
    .toMiddleware(),
];
