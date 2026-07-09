import { z } from 'zod';

export const knowledgeQaTodoKindSchema = z.enum([
  'expand_questions',
  'plan_study',
  'elaborate_section',
  'research_source',
]);

export const knowledgeQaTodoPrioritySchema = z.enum(['high', 'medium', 'low']);

export const knowledgeQaReviewRequestSchema = z.object({
  auditIssues: z.array(z.string()).optional(),
  corpusMd: z.string(),
  invocationId: z.string().optional(),
  requestId: z.string(),
  sessionId: z.string(),
  topic: z.string().trim().min(1),
});

export const knowledgeQaReviewResponseSchema = z.object({
  checks: z.array(z.object({
    id: z.string(),
    note: z.string().optional(),
    pass: z.boolean(),
  })),
  summary: z.string().optional(),
  todos: z.array(z.object({
    detail: z.string().optional(),
    id: z.string(),
    kind: knowledgeQaTodoKindSchema,
    priority: knowledgeQaTodoPrioritySchema,
    summary: z.string(),
  })),
  topic: z.string(),
});
