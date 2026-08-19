import Joi from 'joi';

import { Types } from 'mongoose';

import { Middlewares } from '@omni-infra/express';
import { Queries } from '@omni-infra/mongoose';

import { resolveSessionBySessionId } from '../-resolve-session';
import { isTypesPreambleStage } from '../-types-preamble';
import { isStageFinished, isStageVerifying } from '../-stage-status';
import type {
  TResponseStageDetail,
  TResponseStageListItem,
  TResponseStageReplayItem,
  TResponseStageStatus,
  TStageListSource,
} from '../-api-types';
import type { IStage, TModelResponseTag, TParsedStage, TYahlStage } from '../-types';
import {
  emptyRequestIdUsageSummary,
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
  stage: Pick<TStageListSource, 'finishedAt' | 'verifyingAt'>,
): TResponseStageStatus => {
  if (isStageFinished(stage)) {
    return 'finished';
  }

  if (isStageVerifying(stage)) {
    return 'verifying';
  }

  return 'running';
};

const extractContentPreview = (response: Record<string, unknown>) => {
  const choices = response.choices;

  if (!Array.isArray(choices) || choices.length === 0) {
    return '';
  }

  const first = choices[0] as { message?: { content?: unknown } } | undefined;
  const content = first?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (content !== undefined) {
    return JSON.stringify(content);
  }

  return '';
};

const countByRequestId = async (
  model: { aggregate: typeof modelModelResponse.aggregate },
  sessionRef: Types.ObjectId,
  requestIds: string[],
) => {
  const counts = new Map<string, { count: number; lastCreatedAt?: string }>();

  if (requestIds.length === 0) {
    return counts;
  }

  const rows = await model.aggregate<{ _id: string; count: number; lastCreatedAt?: Date }>([
    { $match: { requestId: { $in: requestIds }, session: sessionRef } },
    { $group: { _id: '$requestId', count: { $sum: 1 }, lastCreatedAt: { $max: '$createdAt' } } },
  ]);

  rows.forEach((row) => {
    counts.set(row._id, {
      count: row.count,
      lastCreatedAt: toIso(row.lastCreatedAt),
    });
  });

  return counts;
};

const listStagesBySessionRef = async (sessionRef: Types.ObjectId) =>
  Queries.queryBy(
    modelStage,
    { session: sessionRef },
    { sort: { createdAt: 1 } },
  ).lean();

export const resolveReplayStageMetadata = (
  stage: Pick<IStage, 'parsedStageIndex' | 'sourceStartLine'>,
  parsedStages: TParsedStage[],
) => {
  const parsedStageIndex = stage.parsedStageIndex;
  const parsedStage = parsedStageIndex != null ? parsedStages[parsedStageIndex] : undefined;
  const sourceStartLine = parsedStage?.sourceStartLine ?? stage.sourceStartLine;

  return { parsedStageIndex, sourceStartLine };
};

const toListItem = (
  stage: TStageListSource & { _id: Types.ObjectId },
  modelCallCount: number,
  toolCallCount: number,
  tokenTotals: TResponseStageListItem['tokenTotals'],
  domains: TResponseStageListItem['domains'],
  byModel: TResponseStageListItem['byModel'],
  timing: {
    lastModelDurationMs: number;
    lastModelResponseAt?: string;
    lastToolCallAt?: string;
    modelDurationMs: number;
  },
): TResponseStageListItem => ({
  createdAt: toIso(stage.createdAt as Date) ?? '',
  finishedAt: toIso(stage.finishedAt),
  isTypesPreamble: isTypesPreambleStage({
    spec: stage.stage,
    type: stage.stage.whileSetup ? 'while' : stage.stage.loopSetup ? 'loop' : 'plain',
  }),
  lastModelDurationMs: timing.lastModelDurationMs,
  ...(timing.lastModelResponseAt ? { lastModelResponseAt: timing.lastModelResponseAt } : {}),
  ...(timing.lastToolCallAt ? { lastToolCallAt: timing.lastToolCallAt } : {}),
  logicPreview: logicPreviewFrom(stage.stage?.logic),
  ...(stage.loopMeta?.kind
    ? { loopKind: stage.loopMeta.kind }
    : typeof stage.loopMeta?.index === 'number' ? { loopKind: 'for' as const } : {}),
  loopSetup: stage.stage?.loopSetup,
  loopIndex: stage.loopMeta?.index,
  loopValue: stage.loopMeta?.value,
  ...(typeof stage.loopMeta?.remainingBashCalls === 'number'
    ? { remainingBashCalls: stage.loopMeta.remainingBashCalls }
    : {}),
  ...(typeof stage.loopMeta?.remainingTurns === 'number'
    ? { remainingTurns: stage.loopMeta.remainingTurns }
    : {}),
  modelCallCount,
  modelDurationMs: timing.modelDurationMs,
  ...(typeof stage.parsedStageIndex === 'number' ? { parsedStageIndex: stage.parsedStageIndex } : {}),
  requestId: stage.requestId,
  stageId: stage._id.toString(),
  status: resolveStageStatus(stage),
  byModel,
  domains,
  tokenTotals,
  toolCallCount,
  updatedAt: toIso(stage.updatedAt as Date) ?? '',
  ...(stage.stage?.whileSetup ? { whileSetup: stage.stage.whileSetup } : {}),
});

export const resolveSessionStagesList = async (sessionId: string) => {
  const session = await resolveSessionBySessionId(sessionId);
  const sessionRef = session._id;

  const stages = await listStagesBySessionRef(sessionRef);

  const requestIds = stages.map((stage) => stage.requestId);

  const [modelCounts, usageByRequestId, toolCounts] = await Promise.all([
    countByRequestId(modelModelResponse, sessionRef, requestIds),
    sumModelResponseUsagesByRequestId(sessionRef, requestIds),
    countByRequestId(modelToolCall, sessionRef, requestIds),
  ]);

  return stages.map((stage) => {
    const usage = usageByRequestId.get(stage.requestId) ?? emptyRequestIdUsageSummary();
    const modelStats = modelCounts.get(stage.requestId);
    const toolStats = toolCounts.get(stage.requestId);

    return toListItem(
      stage,
      modelStats?.count ?? 0,
      toolStats?.count ?? 0,
      usage.tokenTotals,
      usage.domains,
      usage.byModel,
      {
        lastModelDurationMs: usage.lastModelDurationMs,
        lastModelResponseAt: usage.lastModelResponseAt,
        lastToolCallAt: toolStats?.lastCreatedAt,
        modelDurationMs: usage.modelDurationMs,
      },
    );
  });
};

export const resolveSessionStagesReplay = async (sessionId: string) => {
  const session = await resolveSessionBySessionId(sessionId);
  const sessionRef = session._id;
  const parsedStages = session.parsedStages ?? [];

  const stages = await listStagesBySessionRef(sessionRef);

  return stages.map((stage): TResponseStageReplayItem => {
    const { parsedStageIndex, sourceStartLine } = resolveReplayStageMetadata(
      stage,
      parsedStages,
    );

    return {
      context: (stage.context ?? {}) as Record<string, unknown>,
      contextAfter: stage.contextAfter as Record<string, unknown> | undefined,
      finishedAt: toIso(stage.finishedAt),
      loopMeta: stage.loopMeta,
      ...(parsedStageIndex === undefined ? {} : { parsedStageIndex }),
      requestId: stage.requestId,
      ...(sourceStartLine === undefined ? {} : { sourceStartLine }),
      stage: stage.stage as TYahlStage,
      stageId: String(stage._id),
      temperature: stage.temperature,
      verifyResult: stage.verifyResult
        ? {
          feedback: stage.verifyResult.feedback,
          pass: stage.verifyResult.pass,
          score: stage.verifyResult.score,
        }
        : undefined,
    };
  });
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

      const usageByRequestId = await sumModelResponseUsagesByRequestId(
        sessionRef,
        [params.requestId],
      );
      const usage = usageByRequestId.get(params.requestId) ?? emptyRequestIdUsageSummary();
      const lastToolCallDoc = toolCallDocs[toolCallDocs.length - 1];
      const listItem = toListItem(
        stage,
        modelCallCount,
        toolCallCount,
        usage.tokenTotals,
        usage.domains,
        usage.byModel,
        {
          lastModelDurationMs: usage.lastModelDurationMs,
          lastModelResponseAt: usage.lastModelResponseAt,
          lastToolCallAt: lastToolCallDoc
            ? toIso(lastToolCallDoc.createdAt as Date)
            : undefined,
          modelDurationMs: usage.modelDurationMs,
        },
      );

      const detail: TResponseStageDetail = {
        ...listItem,
        context: (stage.context ?? {}) as Record<string, unknown>,
        contextAfter: stage.contextAfter as Record<string, unknown> | undefined,
        loopMeta: stage.loopMeta,
        modelResponses: modelResponses.map((doc) => {
          const response = (doc.response ?? {}) as Record<string, unknown>;

          return {
            _id: String(doc._id),
            contentPreview: extractContentPreview(response),
            createdAt: toIso(doc.createdAt as Date) ?? '',
            ...(typeof doc.domain === 'string' && doc.domain.trim()
              ? { domain: doc.domain.trim() }
              : {}),
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
