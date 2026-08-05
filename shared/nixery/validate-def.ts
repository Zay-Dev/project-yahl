import { z } from 'zod';

const coercePolicyMode = (value: unknown) => {
  if (value === true) {
    return 'true';
  }

  if (value === false) {
    return 'deny';
  }

  return value;
};

const policyModeSchema = z.preprocess(
  coercePolicyMode,
  z.enum(['true', 'propose', 'deny']),
);

const nixeryPolicySchema = z.object({
  argvPrefix: z.array(z.string()).optional(),
  mode: policyModeSchema,
  tools: z.array(z.string().trim().min(1)).min(1),
});

const nixeryDefBlockSchema = z.object({
  default: policyModeSchema.optional(),
  policies: z.array(nixeryPolicySchema).optional(),
  tools: z.array(z.string().trim().min(1)).optional(),
});

const mountSpecSchema = z.object({
  host: z.string().trim().min(1),
  mode: z.enum(['ro', 'rw']),
});

const inputFieldSchema = z.object({
  required: z.boolean().optional(),
  type: z.literal('string'),
});

const outputSpecSchema = z.object({
  default: z.string().trim().min(1).optional(),
  inlineTool: z.boolean().optional(),
  retry: z.number().int().min(0).optional(),
  validate: z.string().trim().min(1).regex(/\.mjs$/).optional(),
});

export const nixeryDefSchema = z.object({
  description: z.string().trim().optional(),
  dockerfile: z.string().trim().min(1).optional(),
  env: z.record(z.string(), z.string()).optional(),
  id: z.string().trim().min(1),
  input: z.record(z.string(), inputFieldSchema).optional(),
  mount: z.record(z.string(), mountSpecSchema).optional(),
  nixery: nixeryDefBlockSchema.optional(),
  output: outputSpecSchema.optional(),
  packages: z.array(z.string().trim().min(1)).min(1),
  run: z.object({
    entry: z.array(z.string().trim().min(1)).min(1),
  }).optional(),
}).superRefine((value, ctx) => {
  const dockerfile = value.dockerfile;

  if (!dockerfile) {
    return;
  }

  if (dockerfile.includes('..') || dockerfile.includes('/') || dockerfile.includes('\\')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'dockerfile must be a filename under the def directory (no path segments)',
      path: ['dockerfile'],
    });
  }
});

export const validateNixeryDef = (raw: unknown) => {
  const parsed = nixeryDefSchema.parse(raw);

  if (parsed.id.includes('/') || parsed.id.includes('..')) {
    throw new Error('nixery def id must not contain path segments');
  }

  return parsed;
};
