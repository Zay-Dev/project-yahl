import { randomUUID } from 'crypto';

import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';

import type {
  TRequestCreateForkSessionBody,
  TResponseCreateForkSession,
} from '../-api-types';
import type { TForkSessionStageSetup } from '../-types';
import { resolveSessionBySessionId } from '../-resolve-session';
import { modelForkSession, modelSession } from '../models';
import { yahlStageSchema } from '../stage-schema';
import { isStageFinished } from '../-stage-status';
import { mergeForkSessionSetups } from './merge-fork-setups';
import { validateForkSourceBundle, ForkSourceBundleError } from '../-fork-source-bundle';
import { resolveSessionStagesReplay } from './stage-read';
import { spawnOrchestrate } from './spawn-orchestrate';

export type TRequestCreateForkSessionParams = {
  sessionId: string;
};

const loopMetaSchema = Joi.object({
  arraySnapshot: Joi.array().required(),
  endAfter: Joi.number().optional(),
  index: Joi.number().required(),
  indexName: Joi.string().optional(),
  startAt: Joi.number().optional(),
  step: Joi.number().optional(),
  temperature: Joi.number().optional(),
  value: Joi.any().required(),
}).unknown(true);

const setupSchema = Joi.object<TForkSessionStageSetup>({
  context: Joi.object().required(),
  loopMeta: loopMetaSchema.optional(),
  stage: yahlStageSchema.required(),
  stageId: Joi.string().trim().required(),
});

const bodySchema = Joi.object<TRequestCreateForkSessionBody>({
  anchorStageId: Joi.string().trim().required(),
  setups: Joi.array().items(setupSchema).min(1).required(),
});

const paramsSchema = Joi.object<TRequestCreateForkSessionParams>({
  sessionId: Joi.string().trim().required(),
});

const _normalizeContainerName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, 63) || 'session';

export const createForkSession = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(bodySchema, req.body),
      params: joi.getValidatedOrThrow(paramsSchema, req.params),
    }))
    .next(async (express, { body, params }) => {
      if (body.setups[0]?.stageId !== body.anchorStageId) {
        throw errors.badRequest('First setup must be the anchor stage');
      }

      const sourceSession = await resolveSessionBySessionId(params.sessionId);
      const replayRows = await resolveSessionStagesReplay(params.sessionId);
      const replayById = new Map(replayRows.map((row) => [row.stageId, row]));

      const anchorRow = replayById.get(body.anchorStageId);

      if (!anchorRow) {
        throw errors.notFound('Anchor stage not found on source session');
      }

      if (!isStageFinished(anchorRow)) {
        throw errors.badRequest('Anchor stage must be finished before rerun');
      }

      if (!body.setups.some((setup) => setup.stageId === body.anchorStageId)) {
        throw errors.badRequest('Setups must include the anchor stage');
      }

      for (const setup of body.setups) {
        if (!replayById.has(setup.stageId)) {
          throw errors.badRequest(`Unknown stage id: ${setup.stageId}`);
        }
      }

      const anchorIndex = replayRows.findIndex((row) => row.stageId === body.anchorStageId);

      if (anchorIndex < 0) {
        throw errors.badRequest('Anchor stage not found in timeline');
      }

      for (let index = 0; index < anchorIndex; index += 1) {
        const row = replayRows[index];

        if (!row?.contextAfter) {
          throw errors.badRequest(
            `Prefix stage ${row?.stageId ?? index} is missing contextAfter; cannot fast-forward`,
          );
        }

        if (!isStageFinished(row)) {
          throw errors.badRequest(
            `Prefix stage ${row.stageId} is not finished; cannot fast-forward`,
          );
        }

        if (row.stage.verify === true && row.verifyResult?.pass !== true) {
          throw errors.badRequest(
            `Prefix stage ${row.stageId} has verify enabled but no passing verify result; cannot fast-forward verify`,
          );
        }
      }

      const setups = mergeForkSessionSetups(replayRows, anchorIndex, body.setups);

      let sourceTaskId: string;

      try {
        sourceTaskId = validateForkSourceBundle(sourceSession);
      } catch (error) {
        if (error instanceof ForkSourceBundleError) {
          throw errors.badRequest(error.message);
        }

        throw error;
      }

      const forkSessionId = randomUUID();
      const targetSessionId = _normalizeContainerName(randomUUID());
      const now = new Date();

      await modelForkSession.create({
        anchorStageId: body.anchorStageId,
        forkSessionId,
        setups,
        sourceSessionId: params.sessionId,
        targetSessionId,
      });

      await modelSession.updateOne(
        { sessionId: targetSessionId },
        {
          $set: {
            forkedFrom: {
              anchorStageId: body.anchorStageId,
              forkSessionId,
              sourceSessionId: params.sessionId,
            },
            isBackground: sourceSession.isBackground === true,
            parsedStages: sourceSession.parsedStages,
            taskId: sourceTaskId,
            taskSkills: sourceSession.taskSkills,
            taskYahl: sourceSession.taskYahl,
            updatedAt: now,
            ...(sourceSession.resultContextKey
              ? { resultContextKey: sourceSession.resultContextKey }
              : {}),
          },
          $setOnInsert: {
            sessionId: targetSessionId,
          },
        },
        { upsert: true },
      );

      try {
        await spawnOrchestrate(targetSessionId, ['--forkrun-id', forkSessionId]);
      } catch (spawnError) {
        console.error('[createForkSession] spawn failed:', spawnError);
        throw errors.custom('Failed to start orchestrator for fork run', 500);
      }

      express.res.status(202);
      express.respondOne<TResponseCreateForkSession>({
        forkSessionId,
        targetSessionId,
      });
    })
    .toMiddleware(),
];
