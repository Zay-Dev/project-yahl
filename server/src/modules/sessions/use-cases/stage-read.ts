import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';
import { Queries } from '@omni-infra/mongoose';

import { resolveSessionBySessionId } from '../-resolve-session';
import type {
  TResponseStageDetail,
  TResponseStageListItem,
  TResponseStageStatus,
  TStageListSource,
} from '../-api-types';
import type { IStage, TYahlStage } from '../-types';
import { normalizeUsageToTokenTotals } from '../-usage-normalize';
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

const parseToolArguments = (raw: unknown) => {
  if (raw === undefined || raw === null) {
    return null;
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }

  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

const resolveStageStatus = (
  stage: Pick<TStageListSource, 'contextAfter' | 'finishedAt'>,
): TResponseStageStatus => {
  if (stage.finishedAt || stage.contextAfter) {
    return 'finished';
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

const parseToolSummaries = (toolCalls: Record<string, unknown>[]) => {
  return toolCalls.map((toolCall, index) => {
    const fn = toolCall.function as { arguments?: unknown; name?: string } | undefined;

    return {
      arguments: parseToolArguments(fn?.arguments),
      id: typeof toolCall.id === 'string' ? toolCall.id : `tool-${index}`,
      name: typeof fn?.name === 'string' ? fn.name : 'unknown',
    };
  });
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

const toListItem = (
  stage: TStageListSource & { _id: unknown },
  modelCallCount: number,
  toolCallCount: number,
): TResponseStageListItem => ({
  createdAt: toIso(stage.createdAt as Date) ?? '',
  finishedAt: toIso(stage.finishedAt),
  logicPreview: logicPreviewFrom(stage.stage?.logic),
  loopIndex: stage.loopMeta?.index,
  loopValue: stage.loopMeta?.value,
  modelCallCount,
  requestId: stage.requestId,
  status: resolveStageStatus(stage),
  tokenTotals: stage.tokenTotals ?? null,
  toolCallCount,
  updatedAt: toIso(stage.updatedAt as Date) ?? '',
});

export const getSessionStages = [
  Middlewares.Chainable
    .validate(({ req }) => joi.getValidatedOrThrow(sessionParamsSchema, req.params))
    .next(async (express, params) => {
      const session = await resolveSessionBySessionId(params.sessionId);
      const sessionRef = session._id;

      const stages = await modelStage
        .find({ session: sessionRef })
        .sort({ createdAt: 1 })
        .lean();

      const requestIds = stages.map((stage) => stage.requestId);

      const [modelCounts, toolCounts] = await Promise.all([
        countByRequestId(modelModelResponse, sessionRef, requestIds),
        countByRequestId(modelToolCall, sessionRef, requestIds),
      ]);

      const items = stages.map((stage) => toListItem(
        stage as IStage & { _id: unknown },
        modelCounts.get(stage.requestId) ?? 0,
        toolCounts.get(stage.requestId) ?? 0,
      ));

      await express.respondMany<TResponseStageListItem>(items, items.length, { skipHydrate: true });
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

      const listItem = toListItem(
        stage as IStage & { _id: unknown },
        modelCallCount,
        toolCallCount,
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
