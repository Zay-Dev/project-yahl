import type { Request, Response } from 'express';

import Joi from 'joi';

import { Queries } from '@omni-infra/mongoose';
import { Middlewares } from '@omni-infra/express';

import type {
  TResponseGetSession,
  TResponseSessionListItem,
} from '../-api-types';
import type { ISession, TTokenTotals } from '../-types';
import { sumModelResponseUsagesBySessionRef, sumModelResponseUsagesForSession } from '../-usage-normalize';
import { resolveSessionRunState } from '../-session-run-state';
import { modelSession, modelStage } from '../models';

export type {
  TResponseGetSession,
  TResponseSessionListItem,
  TResponseTokenTotals,
} from '../-api-types';

export type TRequestGetSessionParams = {
  sessionId: string;
};

const paramsSchema = Joi.object<TRequestGetSessionParams>({
  sessionId: Joi.string().trim().required(),
});

const toIso = (value: Date | string | undefined | null) => {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value.toISOString() : String(value);
};

const toResponse = (
  session: ISession & { _id: unknown },
  tokenTotals: TTokenTotals | null,
  runState: TResponseGetSession['runState'],
): TResponseGetSession => ({
  _id: String(session._id),
  createdAt: toIso(session.createdAt) ?? '',
  deletedAt: toIso(session.deletedAt),
  forkedFrom: session.forkedFrom,
  isBackground: session.isBackground === true,
  liveViewVncPort: session.liveViewVncPort ?? null,
  parsedStages: session.parsedStages ?? [],
  result: session.result,
  resultContextKey: session.resultContextKey,
  runInput: session.runInput ?? {},
  runState,
  sessionId: session.sessionId,
  taskId: session.taskId ?? '',
  taskSkills: session.taskSkills ?? [],
  taskYahl: session.taskYahl ?? '',
  tokenTotals,
  updatedAt: toIso(session.updatedAt) ?? '',
});

const toListResponse = (
  session: ISession & { _id: unknown },
  tokenTotals: TTokenTotals | null,
): TResponseSessionListItem => ({
  _id: String(session._id),
  createdAt: toIso(session.createdAt) ?? '',
  deletedAt: toIso(session.deletedAt),
  isBackground: session.isBackground === true,
  sessionId: session.sessionId,
  taskId: session.taskId,
  tokenTotals,
  updatedAt: toIso(session.updatedAt) ?? '',
});

const writeSse = (res: Response, event: string, payload: unknown) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const resolveSessionsList = async () => {
  const sessions = await modelSession.find(
    { deletedAt: null },
    {
      _id: 1,
      createdAt: 1,
      deletedAt: 1,
      isBackground: 1,
      sessionId: 1,
      taskId: 1,
      updatedAt: 1,
    },
    {
      lean: true,
      sort: { updatedAt: -1 },
    },
  )
    .limit(100);

  const sessionRefs = sessions.map((session) => session._id);
  const tokenTotalsBySessionRef = await sumModelResponseUsagesBySessionRef(sessionRefs);

  return sessions.map((session) => toListResponse(
    session as ISession & { _id: unknown },
    tokenTotalsBySessionRef.get(String(session._id)) ?? null,
  ));
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
      const [tokenTotals, stages] = await Promise.all([
        sumModelResponseUsagesForSession(session._id),
        Queries.queryBy(
          modelStage,
          { session: session._id },
          { sort: { createdAt: 1 } },
        ).lean(),
      ]);
      const runState = resolveSessionRunState({
        sessionId: params.sessionId,
        stages,
      });

      express.respondOne<TResponseGetSession>(toResponse(session, tokenTotals, runState));
    })
    .toMiddleware(),
];
