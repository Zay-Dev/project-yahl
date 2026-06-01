import Joi from 'joi';

import { Queries } from '@omni-infra/mongoose';
import { Middlewares } from '@omni-infra/express';

import type { ISession, TTokenTotals } from '../-types';
import { modelSession } from '../models';

export type TRequestGetSessionParams = {
  sessionId: string;
};

export type TResponseTokenTotals = TTokenTotals;

export type TResponseGetSession = Pick<
  ISession,
  | 'sessionId'
  | 'taskYahlPath'
  | 'createdAt'
  | 'updatedAt'
  | 'deletedAt'
> & {
  _id: string;
  result?: unknown;
  tokenTotals: TResponseTokenTotals | null;
};

const paramsSchema = Joi.object<TRequestGetSessionParams>({
  sessionId: Joi.string().trim().required(),
});

const toResponse = (session: ISession & { _id: unknown }): TResponseGetSession => ({
  _id: String(session._id),
  createdAt: session.createdAt,
  deletedAt: session.deletedAt,
  result: session.result,
  sessionId: session.sessionId,
  taskYahlPath: session.taskYahlPath,
  tokenTotals: session.tokenTotals ?? null,
  updatedAt: session.updatedAt,
});

export const getSession = [
  Middlewares.Chainable
    .validate(({ req }) => joi.getValidatedOrThrow(paramsSchema, req.params))
    .next(async (express, params) => {
      const session = await Queries.hasExactOne(modelSession, { sessionId: params.sessionId });

      express.respondOne<TResponseGetSession>(toResponse(session));
    })
    .toMiddleware(),
];
