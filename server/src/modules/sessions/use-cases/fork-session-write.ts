import { randomUUID } from 'crypto';

import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';

import type {
  TRequestCreateForkSessionBody,
  TResponseCreateForkSession,
} from '../-api-types';
import type { TForkSessionStageSetup, TParsedStage } from '../-types';
import {
  buildForkPatchedParsedStages,
  deriveForkStorageSeed,
  ForkPatchedPipelineError,
  prefixRowsForForkCopy,
} from '../-fork-patched-pipeline';
import { resolveSessionBySessionId } from '../-resolve-session';
import { copySessionWorkspace } from '../-workspace-paths';
import { modelForkSession, modelSession } from '../models';
import { yahlStageSchema } from '../stage-schema';
import { isStageFinished } from '../-stage-status';
import { validateForkSourceBundle, ForkSourceBundleError } from '../-fork-source-bundle';
import { resolveSessionStagesReplay } from './stage-read';
import { spawnOrchestrate } from './spawn-orchestrate';
import { copyPrefixStagesToSession } from '../use-cases.services/copy-fork-prefix-stages';
import { parseSessionYahlTask } from '../-parse-session-yahl';

export type TRequestCreateForkSessionParams = {
  sessionId: string;
};

const loopMetaSchema = Joi.object({
  arraySnapshot: Joi.array().optional(),
  endAfter: Joi.number().optional(),
  index: Joi.number().optional(),
  indexName: Joi.string().optional(),
  kind: Joi.string().valid('for', 'warmup', 'while').optional(),
  remainingBashCalls: Joi.number().integer().min(0).optional(),
  remainingTurns: Joi.number().integer().min(0).optional(),
  startAt: Joi.number().optional(),
  step: Joi.number().optional(),
  temperature: Joi.number().optional(),
  value: Joi.any().optional(),
}).unknown(true);

const setupSchema = Joi.object<TForkSessionStageSetup>({
  context: Joi.object().required(),
  loopMeta: loopMetaSchema.optional(),
  parsedStageIndex: Joi.number().integer().min(0).optional(),
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

export const patchRunInputFromStorageSeed = (params: {
  runInputContextKeys: string[];
  sourceRunInput: Record<string, unknown>;
  storageSeed: Record<string, unknown>;
}) => {
  const { runInputContextKeys, sourceRunInput, storageSeed } = params;

  const storageSeedContext = storageSeed && typeof (storageSeed as { context?: unknown }).context === 'object'
    ? (storageSeed as { context?: Record<string, unknown> }).context
    : undefined;

  const storageContext = storageSeedContext && !Array.isArray(storageSeedContext)
    ? storageSeedContext
    : undefined;

  if (!storageContext) {
    return sourceRunInput;
  }

  const patched: Record<string, unknown> = { ...sourceRunInput };

  for (const key of runInputContextKeys) {
    if (Object.prototype.hasOwnProperty.call(storageContext, key)) {
      patched[key] = storageContext[key];
    }
  }

  return patched;
};

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

      for (const setup of body.setups.slice(1)) {
        if (setup.parsedStageIndex == null) {
          throw errors.badRequest('Later setups must include parsedStageIndex');
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

        if (row.stage.verify && row.verifyResult?.pass !== true) {
          throw errors.badRequest(
            `Prefix stage ${row.stageId} has verify enabled but no passing verify result; cannot fast-forward verify`,
          );
        }
      }

      const setups = body.setups;

      let sourceTaskId: string;

      try {
        sourceTaskId = validateForkSourceBundle(sourceSession);
      } catch (error) {
        if (error instanceof ForkSourceBundleError) {
          throw errors.badRequest(error.message);
        }

        throw error;
      }

      const taskYahl = sourceSession.taskYahl?.trim();

      if (!taskYahl) {
        throw errors.badRequest('Source session missing taskYahl snapshot');
      }

      const parseOpts = {
        taskId: sourceSession.taskId ?? sourceTaskId,
        taskYahlRefs: sourceSession.taskYahlRefs,
      };
      const { runInputContextKeys } = parseSessionYahlTask(taskYahl, parseOpts);
      const runInputKeys = runInputContextKeys ?? [];

      const anchorSetup = setups[0]!;

      let anchorParsedStageIndex: number;
      let nestedIndex: number | undefined;
      let parsedStages: TParsedStage[];

      try {
        ({ anchorParsedStageIndex, nestedIndex, parsedStages } = buildForkPatchedParsedStages({
          anchorIndex,
          anchorStageId: body.anchorStageId,
          replayRows,
          setups,
          taskId: parseOpts.taskId,
          taskYahl,
          taskYahlRefs: parseOpts.taskYahlRefs,
        }));
      } catch (error) {
        if (error instanceof ForkPatchedPipelineError) {
          throw errors.badRequest(error.message);
        }

        throw error;
      }

      const storageSeed = deriveForkStorageSeed(replayRows, anchorIndex, anchorSetup);
      const prefixRows = prefixRowsForForkCopy(replayRows, anchorIndex);
      const patchedRunInput = patchRunInputFromStorageSeed({
        runInputContextKeys: runInputKeys,
        sourceRunInput: sourceSession.runInput ?? {},
        storageSeed,
      });

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
            browser: sourceSession.browser === true,
            isBackground: sourceSession.isBackground === true,
            parsedStages,
            runCursor: {
              kind: 'pipeline',
              ...(anchorSetup.loopMeta ? { loopMeta: anchorSetup.loopMeta } : {}),
              ...(nestedIndex === undefined ? {} : { nestedIndex }),
              stageIndex: anchorParsedStageIndex,
            },
            runInput: patchedRunInput,
            storageSeed,
            taskId: sourceTaskId,
            taskSkills: sourceSession.taskSkills,
            taskYahl: sourceSession.taskYahl,
            ...(sourceSession.taskYahlRefs
              ? { taskYahlRefs: sourceSession.taskYahlRefs }
              : {}),
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

      const targetSession = await resolveSessionBySessionId(targetSessionId);

      await copyPrefixStagesToSession(String(targetSession._id), prefixRows, now);
      await copySessionWorkspace(params.sessionId, targetSessionId);

      try {
        await spawnOrchestrate(targetSessionId, []);
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
