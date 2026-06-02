import type { Request, Response } from 'express';

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

export type TResponseSessionListItem = Pick<
  ISession,
  | 'sessionId'
  | 'taskYahlPath'
  | 'createdAt'
  | 'updatedAt'
  | 'deletedAt'
> & {
  _id: string;
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

const toListResponse = (
  session: ISession & { _id: unknown },
): TResponseSessionListItem => ({
  _id: String(session._id),
  createdAt: session.createdAt,
  deletedAt: session.deletedAt,
  sessionId: session.sessionId,
  taskYahlPath: session.taskYahlPath,
  tokenTotals: session.tokenTotals ?? null,
  updatedAt: session.updatedAt,
});

const writeSse = (res: Response, event: string, payload: unknown) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const resolveSessionsList = async () => {
  const sessions = await modelSession.find(
    {},
    {
      _id: 1,
      createdAt: 1,
      deletedAt: 1,
      sessionId: 1,
      taskYahlPath: 1,
      tokenTotals: 1,
      updatedAt: 1,
    },
    {
      lean: true,
      sort: { updatedAt: -1 },
    },
  )
    .limit(100);

  return sessions.map(toListResponse);
};

const streamSessions = async (_: Request, res: Response) => {
  res.status(200);
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Content-Type', 'text/event-stream');
  res.flushHeaders();

  let lastPayload = '';

  const publish = async () => {
    const sessions = await resolveSessionsList();
    const nextPayload = JSON.stringify(sessions);

    if (nextPayload !== lastPayload) {
      lastPayload = nextPayload;
      writeSse(res, 'sessions', sessions);
    }
  };

  await publish();
  const sessionsInterval = setInterval(async () => {
    try {
      await publish();
    } catch (error) {
      logger.error('failed to publish sessions stream', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }, 2000);

  const heartbeatInterval = setInterval(() => {
    writeSse(res, 'heartbeat', { at: new Date().toISOString() });
  }, 15000);

  res.on('close', () => {
    clearInterval(heartbeatInterval);
    clearInterval(sessionsInterval);
    res.end();
  });
};

export const getSessions = [streamSessions];

export const getSession = [
  Middlewares.Chainable
    .validate(({ req }) => joi.getValidatedOrThrow(paramsSchema, req.params))
    .next(async (express, params) => {
      const session = await Queries.hasExactOne(modelSession, { sessionId: params.sessionId });

      express.respondOne<TResponseGetSession>(toResponse(session));
    })
    .toMiddleware(),
];
