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
import { isProtectedOneCliSecretName } from '../-onecli-protected';

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

const toResponse = (raw: TOneCliSecretRaw): TResponseOneCliSecret => {
  const name = raw.name || '';

  return {
    createdAt: raw.createdAt,
    headerName: raw.injectionConfig?.headerName,
    hostPattern: raw.hostPattern || '',
    id: raw.id || '',
    isProtected: isProtectedOneCliSecretName(name),
    name,
    pathPattern: raw.pathPattern ?? undefined,
    preview: raw.preview,
    type: raw.type || 'generic',
    valueFormat: raw.injectionConfig?.valueFormat,
  };
};

const findSecretById = async (id: string): Promise<TOneCliSecretRaw | undefined> => {
  const { data } = await oneCliRequest<unknown>('GET', '/secrets');

  return normalizeSecretList(data).find((item) => item.id === id);
};

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
      if (isProtectedOneCliSecretName(body.name)) {
        throw errors.badRequest('Cannot create a secret with a seeded OneCLI name');
      }

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

export const deleteOneCliSecret = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(paramsSchema, req.params),
    }))
    .next(async (express, { params }) => {
      const existing = await findSecretById(params.id);
      if (!existing?.id) {
        throw errors.notFound('OneCLI secret not found');
      }

      if (isProtectedOneCliSecretName(existing.name || '')) {
        throw errors.badRequest('Cannot delete seeded OneCLI secret');
      }

      await oneCliRequest('DELETE', `/secrets/${params.id}`);

      express.respondOne({ id: params.id, ok: true as const });
    })
    .toMiddleware(),
];
