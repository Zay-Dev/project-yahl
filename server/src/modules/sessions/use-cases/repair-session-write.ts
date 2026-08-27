import { randomUUID } from 'crypto';

import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';

import type {
  TRequestCreateRepairSessionBody,
  TResponseCreateRepairSession,
} from '../-api-types';
import type { TForkSessionStageSetup } from '../-types';
import {
  deriveForkStorageSeed,
  prefixRowsForForkCopy,
  resolveAnchorParsedStageIndex,
} from '../-fork-patched-pipeline';
import { resolveSessionBySessionId } from '../-resolve-session';
import { copySessionWorkspace } from '../-workspace-paths';
import { modelForkSession, modelSession } from '../models';
import { isStageFinished } from '../-stage-status';
import { validateForkSourceBundle, ForkSourceBundleError } from '../-fork-source-bundle';
import { resolveSessionStagesReplay } from './stage-read';
import { spawnOrchestrate } from './spawn-orchestrate';
import { copyPrefixStagesToSession } from '../use-cases.services/copy-fork-prefix-stages';
import { parseSessionYahlTask } from '../-parse-session-yahl';
import { patchRunInputFromStorageSeed } from './fork-session-write';

export type TRequestCreateRepairSessionParams = {
  sessionId: string;
};

const REPAIR_INSTRUCTION_MAX_LENGTH = 4096;

const bodySchema = Joi.object<TRequestCreateRepairSessionBody>({
  anchorStageId: Joi.string().trim().required(),
  instruction: Joi.string().trim().min(1).max(REPAIR_INSTRUCTION_MAX_LENGTH).required(),
});

const paramsSchema = Joi.object<TRequestCreateRepairSessionParams>({
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

export const createRepairSession = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(bodySchema, req.body),
      params: joi.getValidatedOrThrow(paramsSchema, req.params),
    }))
    .next(async (express, { body, params }) => {
      const sourceSession = await resolveSessionBySessionId(params.sessionId);
      const replayRows = await resolveSessionStagesReplay(params.sessionId);
      const replayById = new Map(replayRows.map((row) => [row.stageId, row]));

      const anchorRow = replayById.get(body.anchorStageId);

      if (!anchorRow) {
        throw errors.notFound('Anchor stage not found on source session');
      }

      if (!isStageFinished(anchorRow)) {
        throw errors.badRequest('Anchor stage must be finished before repair');
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
      const parsedStages = sourceSession.parsedStages
        ?? parseSessionYahlTask(taskYahl, parseOpts).stages;

      if (!parsedStages.length) {
        throw errors.badRequest('Source session missing parsedStages');
      }

      const anchorParsedStageIndex = resolveAnchorParsedStageIndex(
        replayRows,
        anchorIndex,
        body.anchorStageId,
      );

      if (anchorParsedStageIndex < 0 || anchorParsedStageIndex >= parsedStages.length) {
        throw errors.badRequest(
          `Anchor parsedStageIndex ${anchorParsedStageIndex} is out of range`,
        );
      }

      const anchorSetup: TForkSessionStageSetup = {
        context: anchorRow.context,
        ...(anchorRow.loopMeta ? { loopMeta: anchorRow.loopMeta } : {}),
        stage: anchorRow.stage,
        stageId: anchorRow.stageId,
      };

      const { runInputContextKeys } = parseSessionYahlTask(taskYahl, parseOpts);
      const runInputKeys = runInputContextKeys ?? [];
      const storageSeed = deriveForkStorageSeed(replayRows, anchorIndex, anchorSetup);
      const prefixRows = prefixRowsForForkCopy(replayRows, anchorIndex);
      const patchedRunInput = patchRunInputFromStorageSeed({
        runInputContextKeys: runInputKeys,
        sourceRunInput: sourceSession.runInput ?? {},
        storageSeed,
      });

      const instruction = body.instruction.trim();
      const forkSessionId = randomUUID();
      const targetSessionId = _normalizeContainerName(randomUUID());
      const now = new Date();

      await modelForkSession.create({
        anchorStageId: body.anchorStageId,
        forkSessionId,
        repairInstruction: instruction,
        setups: [anchorSetup],
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
            parsedStages,
            runCursor: {
              kind: 'repair',
              ...(anchorRow.loopMeta ? { loopMeta: anchorRow.loopMeta } : {}),
              repairInstruction: instruction,
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
        console.error('[createRepairSession] spawn failed:', spawnError);
        throw errors.custom('Failed to start orchestrator for repair run', 500);
      }

      express.res.status(202);
      express.respondOne<TResponseCreateRepairSession>({
        forkSessionId,
        targetSessionId,
      });
    })
    .toMiddleware(),
];
