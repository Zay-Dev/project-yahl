import { z } from 'zod';

export const verifyStageSnapshotSchema = z.object({
  askUser: z.array(z.record(z.string(), z.unknown())).optional(),
  contextKeys: z.array(z.string()).optional(),
  logic: z.string().optional(),
  produceContextKeys: z.array(z.string()).optional(),
});

export const verifyResumeActionSchema = z.enum(['rerun', 'edit_answer', 'reask', 'follow_up']);

export const verifyRequestSchema = z.object({
  contextSnapshot: z.record(z.string(), z.unknown()),
  invocationId: z.string().optional(),
  minScore: z.number().min(0).max(1).optional(),
  requestId: z.string(),
  rubric: z.string().optional(),
  sessionId: z.string(),
  stageIndex: z.number().int().nonnegative(),
  stageSnapshot: verifyStageSnapshotSchema.optional(),
  stageVersion: z.number().int().positive().optional(),
  verifyResume: z.boolean().optional(),
});

export const verifyResponseSchema = z.object({
  askUserRef: z.string().optional(),
  feedback: z.string(),
  pass: z.boolean(),
  resumeAction: verifyResumeActionSchema.optional(),
  score: z.number().min(0).max(1),
  unavailable: z.boolean().optional(),
});

export const requestStatusQuerySchema = z.object({
  invocationId: z.string().trim().min(1).optional(),
  requestId: z.string().trim().min(1),
  sessionId: z.string().trim().min(1),
});
