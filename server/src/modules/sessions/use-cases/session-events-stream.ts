import type { Request, Response } from 'express';

import Joi from 'joi';

import type { TResponseStageListItem } from '../-api-types';
import { subscribeSessionEvents } from '../-session-events';

import { resolveSessionStagesList } from './stage-read';

type TRequestSessionEventsParams = {
  sessionId: string;
};

const paramsSchema = Joi.object<TRequestSessionEventsParams>({
  sessionId: Joi.string().trim().required(),
});

const writeSse = (res: Response, event: string, payload: unknown) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

export const streamSessionEvents = async (req: Request, res: Response) => {
  const params = joi.getValidatedOrThrow(paramsSchema, req.params);

  let stages: TResponseStageListItem[] = [];

  try {
    stages = await resolveSessionStagesList(params.sessionId);
  } catch {
    stages = [];
  }

  res.status(200);
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Content-Type', 'text/event-stream');
  res.flushHeaders();

  writeSse(res, 'snapshot', { stages } satisfies { stages: TResponseStageListItem[] });

  const unsubscribe = subscribeSessionEvents(params.sessionId, (event) => {
    writeSse(res, 'session-event', event);
  });

  const heartbeatInterval = setInterval(() => {
    writeSse(res, 'heartbeat', { at: new Date().toISOString() });
  }, 15000);

  res.on('close', () => {
    clearInterval(heartbeatInterval);
    unsubscribe();
    res.end();
  });
};

export const getSessionEventsStream = [streamSessionEvents];
