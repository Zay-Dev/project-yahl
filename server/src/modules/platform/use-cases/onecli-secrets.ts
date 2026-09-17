import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';

import type {
  TRequestCreateOneCliSecretBody,
  TRequestOneCliSecretParams,
  TRequestUpdateOneCliSecretBody,
  TResponseOneCliSecret,
  TResponseOneCliSecrets,
} from '../-api-types';
import { normalizeSecretList, oneCliRequest, type TOneCliSecretRaw } from '../-onecli-client';

const paramsSchema = Joi.object<TRequestOneCliSecretParams>({
  id: Joi.string().trim().required(),
});

const updateBodySchema = Joi.object<TRequestUpdateOneCliSecretBody>({
  value: Joi.string().trim().min(1).required(),
});

const createBodySchema = Joi.object<TRequestCreateOneCliSecretBody>({
  hostPattern: Joi.string().trim().required(),
  name: Joi.string().trim().required(),
  pathPattern: Joi.string().trim().allow('').optional(),
  value: Joi.string().trim().min(1).required(),
});

const toResponse = (raw: TOneCliSecretRaw): TResponseOneCliSecret => ({
  createdAt: raw.createdAt,
  headerName: raw.injectionConfig?.headerName,
  hostPattern: raw.hostPattern || '',
  id: raw.id || '',
  name: raw.name || '',
  pathPattern: raw.pathPattern ?? undefined,
  preview: raw.preview,
  type: raw.type || 'generic',
  valueFormat: raw.injectionConfig?.valueFormat,
});

export const listOneCliSecrets = [
  Middlewares.Chainable
    .next(async (express) => {
      const { data } = await oneCliRequest<unknown>('GET', '/secrets');
      const items = normalizeSecretList(data).map(toResponse).filter((item) => item.id);

      express.respondOne<TResponseOneCliSecrets>({ items });
    })
    .toMiddleware(),
];

export const updateOneCliSecret = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(updateBodySchema, req.body),
      params: joi.getValidatedOrThrow(paramsSchema, req.params),
    }))
    .next(async (express, { body, params }) => {
      const { data } = await oneCliRequest<TOneCliSecretRaw>('PATCH', `/secrets/${params.id}`, {
        value: body.value,
      });

      express.respondOne<TResponseOneCliSecret>(toResponse(data));
    })
    .toMiddleware(),
];

export const createOneCliSecret = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(createBodySchema, req.body),
    }))
    .next(async (express, { body }) => {
      const payload: Record<string, unknown> = {
        hostPattern: body.hostPattern,
        injectionConfig: {
          headerName: 'Authorization',
          valueFormat: 'Bearer {value}',
        },
        name: body.name,
        type: 'generic',
        value: body.value,
      };

      if (body.pathPattern) {
        payload.pathPattern = body.pathPattern;
      }

      const { data } = await oneCliRequest<TOneCliSecretRaw>('POST', '/secrets', payload);

      express.respondOne<TResponseOneCliSecret>(toResponse(data));
    })
    .toMiddleware(),
];
