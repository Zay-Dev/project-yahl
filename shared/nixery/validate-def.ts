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

export const nixeryDefSchema = z.object({
  description: z.string().trim().optional(),
  env: z.record(z.string(), z.string()).optional(),
  id: z.string().trim().min(1),
  input: z.record(z.string(), inputFieldSchema).optional(),
  mount: z.record(z.string(), mountSpecSchema).optional(),
  nixery: nixeryDefBlockSchema.optional(),
  packages: z.array(z.string().trim().min(1)).min(1),
  run: z.object({
    entry: z.array(z.string().trim().min(1)).min(1),
  }).optional(),
});

export const validateNixeryDef = (raw: unknown) => {
  const parsed = nixeryDefSchema.parse(raw);

  if (parsed.id.includes('/') || parsed.id.includes('..')) {
    throw new Error('nixery def id must not contain path segments');
  }

  return parsed;
};
