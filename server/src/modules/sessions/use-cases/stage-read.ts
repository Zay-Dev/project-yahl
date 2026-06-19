import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';
import { Queries } from '@omni-infra/mongoose';

import { resolveSessionBySessionId } from '../-resolve-session';
import { isStageFinished } from '../-stage-status';
import type {
  TResponseStageDetail,
  TResponseStageListItem,
  TResponseStageReplayItem,
  TResponseStageStatus,
  TStageListSource,
} from '../-api-types';
import type { IStage, TModelResponseTag, TYahlStage } from '../-types';
import {
  normalizeUsageToTokenTotals,
  sumModelResponseUsagesByRequestId,
} from '../-usage-normalize';
import { parseToolSummaries } from '../-utils/normalize-tool-call';
import { modelModelResponse, modelStage, modelToolCall } from '../models';

import type { TRequestStageParams } from './stage-write';

export type {
  TResponseStageDetail,
  TResponseStageListItem,
  TResponseStageModelResponseItem,
  TResponseStageStatus,
  TResponseStageToolCallItem,
} from '../-api-types';

const LOGIC_PREVIEW_LINES = 5;
const LOGIC_PREVIEW_MAX_CHARS = 600;
const CONTENT_PREVIEW_MAX = 280;

const sessionParamsSchema = Joi.object({
  sessionId: Joi.string().trim().required(),
});

const stageParamsSchema = Joi.object<TRequestStageParams>({
  requestId: Joi.string().trim().required(),
  sessionId: Joi.string().trim().required(),
});

const toIso = (value: Date | string | undefined) => {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value.toISOString() : String(value);
};

const logicPreviewFrom = (logic: string | undefined) => {
  const lines = (logic ?? '')
    .split('\n')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .slice(0, LOGIC_PREVIEW_LINES);

  const joined = lines.join('\n');

  if (joined.length <= LOGIC_PREVIEW_MAX_CHARS) {
    return joined;
  }

  return `${joined.slice(0, LOGIC_PREVIEW_MAX_CHARS)}…`;
};

export const resolveStageStatus = (
  stage: Pick<TStageListSource, 'finishedAt'>,
): TResponseStageStatus => (isStageFinished(stage) ? 'finished' : 'running');

const extractContentPreview = (response: Record<string, unknown>) => {
  const choices = response.choices;

  if (!Array.isArray(choices) || choices.length === 0) {
    return '';
  }

  const first = choices[0] as { message?: { content?: unknown } } | undefined;
  const content = first?.message?.content;

  if (typeof content === 'string') {
    if (content.length <= CONTENT_PREVIEW_MAX) {
      return content;
    }

    return `${content.slice(0, CONTENT_PREVIEW_MAX)}…`;
  }

  if (content !== undefined) {
    const serialized = JSON.stringify(content);

    if (serialized.length <= CONTENT_PREVIEW_MAX) {
      return serialized;
    }

    return `${serialized.slice(0, CONTENT_PREVIEW_MAX)}…`;
  }

  return '';
};

const countByRequestId = async (
  model: { aggregate: typeof modelModelResponse.aggregate },
  sessionRef: unknown,
  requestIds: string[],
) => {
  const counts = new Map<string, number>();

  if (requestIds.length === 0) {
    return counts;
  }

  const rows = await model.aggregate<{ _id: string; count: number }>([
    { $match: { requestId: { $in: requestIds }, session: sessionRef } },
    { $group: { _id: '$requestId', count: { $sum: 1 } } },
  ]);

  rows.forEach((row) => {
    counts.set(row._id, row.count);
  });

  return counts;
};

const listStagesBySessionRef = async (sessionRef: unknown) =>
  Queries.queryBy(
    modelStage,
    { session: sessionRef },
    { sort: { createdAt: 1 } },
  ).lean();

const toListItem = (
  stage: TStageListSource & { _id: unknown },
  modelCallCount: number,
  toolCallCount: number,
  tokenTotals: TResponseStageListItem['tokenTotals'],
): TResponseStageListItem => ({
  createdAt: toIso(stage.createdAt as Date) ?? '',
  finishedAt: toIso(stage.finishedAt),
  logicPreview: logicPreviewFrom(stage.stage?.logic),
  loopSetup: stage.stage?.loopSetup,
  loopIndex: stage.loopMeta?.index,
  loopValue: stage.loopMeta?.value,
  modelCallCount,
  requestId: stage.requestId,
  stageId: String(stage._id),
  status: resolveStageStatus(stage),
  tokenTotals,
  toolCallCount,
  updatedAt: toIso(stage.updatedAt as Date) ?? '',
});

export const resolveSessionStagesList = async (sessionId: string) => {
  const session = await resolveSessionBySessionId(sessionId);
  const sessionRef = session._id;

  const stages = await listStagesBySessionRef(sessionRef);

  const requestIds = stages.map((stage) => stage.requestId);

  const [modelCounts, tokenTotalsByRequestId, toolCounts] = await Promise.all([
    countByRequestId(modelModelResponse, sessionRef, requestIds),
    sumModelResponseUsagesByRequestId(sessionRef, requestIds),
    countByRequestId(modelToolCall, sessionRef, requestIds),
  ]);

  return stages.map((stage) => toListItem(
    stage as IStage & { _id: unknown },
    modelCounts.get(stage.requestId) ?? 0,
    toolCounts.get(stage.requestId) ?? 0,
    tokenTotalsByRequestId.get(stage.requestId) ?? null,
  ));
};

export const resolveSessionStagesReplay = async (sessionId: string) => {
  const session = await resolveSessionBySessionId(sessionId);
  const sessionRef = session._id;

  const stages = await listStagesBySessionRef(sessionRef);

  return stages.map((stage): TResponseStageReplayItem => ({
    context: (stage.context ?? {}) as Record<string, unknown>,
    contextAfter: stage.contextAfter as Record<string, unknown> | undefined,
    finishedAt: toIso(stage.finishedAt),
    loopMeta: stage.loopMeta,
    requestId: stage.requestId,
    stage: stage.stage as TYahlStage,
    stageId: String(stage._id),
    temperature: stage.temperature,
  }));
};

export const getSessionStages = [
  Middlewares.Chainable
    .validate(({ req }) => joi.getValidatedOrThrow(sessionParamsSchema, req.params))
    .next(async (express, params) => {
      const items = await resolveSessionStagesList(params.sessionId);

      await express.respondMany<TResponseStageListItem>(items, items.length, { skipHydrate: true });
    })
    .toMiddleware(),
];

export const getSessionStagesReplay = [
  Middlewares.Chainable
    .validate(({ req }) => joi.getValidatedOrThrow(sessionParamsSchema, req.params))
    .next(async (express, params) => {
      const items = await resolveSessionStagesReplay(params.sessionId);

      await express.respondMany<TResponseStageReplayItem>(items, items.length, { skipHydrate: true });
    })
    .toMiddleware(),
];

export const getSessionStage = [
  Middlewares.Chainable
    .validate(({ req }) => joi.getValidatedOrThrow(stageParamsSchema, req.params))
    .next(async (express, params) => {
      const session = await resolveSessionBySessionId(params.sessionId);
      const sessionRef = session._id;

      const stage = await Queries.hasExactOne(modelStage, {
        requestId: params.requestId,
        session: sessionRef,
      });

      const [modelCallCount, toolCallCount, modelResponses, toolCallDocs] = await Promise.all([
        modelModelResponse.countDocuments({ requestId: params.requestId, session: sessionRef }),
        modelToolCall.countDocuments({ requestId: params.requestId, session: sessionRef }),
        modelModelResponse
          .find({ requestId: params.requestId, session: sessionRef })
          .sort({ createdAt: 1 })
          .lean(),
        modelToolCall
          .find({ requestId: params.requestId, session: sessionRef })
          .sort({ createdAt: 1 })
          .lean(),
      ]);

      const tokenTotalsByRequestId = await sumModelResponseUsagesByRequestId(
        sessionRef,
        [params.requestId],
      );

      const listItem = toListItem(
        stage as IStage & { _id: unknown },
        modelCallCount,
        toolCallCount,
        tokenTotalsByRequestId.get(params.requestId) ?? null,
      );

      const stageDoc = stage as IStage;

      const detail: TResponseStageDetail = {
        ...listItem,
        context: (stageDoc.context ?? {}) as Record<string, unknown>,
        contextAfter: stageDoc.contextAfter as Record<string, unknown> | undefined,
        loopMeta: stage.loopMeta,
        modelResponses: modelResponses.map((doc) => {
          const response = (doc.response ?? {}) as Record<string, unknown>;

          return {
            _id: String(doc._id),
            contentPreview: extractContentPreview(response),
            createdAt: toIso(doc.createdAt as Date) ?? '',
            durationMs: doc.durationMs,
            model: typeof response.model === 'string' ? response.model : undefined,
            response,
            tags: Array.isArray(doc.tags) ? doc.tags as TModelResponseTag[] : undefined,
            thinkingMode: doc.thinkingMode,
            usage: normalizeUsageToTokenTotals(response.usage),
          };
        }),
        stage: stage.stage as TYahlStage,
        toolCalls: toolCallDocs.map((doc) => ({
          _id: String(doc._id),
          createdAt: toIso(doc.createdAt as Date) ?? '',
          tools: parseToolSummaries(
            Array.isArray(doc.toolCalls) ? doc.toolCalls as Record<string, unknown>[] : [],
          ),
        })),
      };

      express.respondOne<TResponseStageDetail>(detail);
    })
    .toMiddleware(),
];
