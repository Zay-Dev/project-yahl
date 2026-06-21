import { z } from 'zod';

export const WORKSPACE_CONTAINER_ROOT = '/root';

export const resolveWorkspacePath = (input: string): string => {
  const trimmed = input.trim();

  if (trimmed.startsWith('~/')) {
    return `${WORKSPACE_CONTAINER_ROOT}/${trimmed.slice(2)}`;
  }

  if (trimmed === '~') {
    return WORKSPACE_CONTAINER_ROOT;
  }

  return trimmed;
};

export const orgScopeSchema = z.object({
  orgId: z.string().optional(),
  orgUnitId: z.string().optional(),
  userId: z.string().optional(),
});

export const skillNames = [
  'research',
  'extract-info',
  'extract-knowledge',
  'persist-knowledge',
  'media-to-text',
  'plan',
  'design-questions',
  'propose-notification',
] as const;

export type TSkillName = (typeof skillNames)[number];

export const skillRequestSchema = z.object({
  args: z.record(z.string(), z.unknown()).default({}),
  caller: z.enum(['stage-agent', 'orchestrator']).default('stage-agent'),
  sessionId: z.string().optional(),
  ...orgScopeSchema.shape,
});

export type TSkillRequest = z.infer<typeof skillRequestSchema>;

export const skillResponseSchema = z.object({
  data: z.unknown().optional(),
  error: z.string().optional(),
  ok: z.boolean(),
});

export type TSkillResponse = z.infer<typeof skillResponseSchema>;

export const verifyStageSnapshotSchema = z.object({
  askUser: z.array(z.record(z.string(), z.unknown())).optional(),
  contextKeys: z.array(z.string()).optional(),
  logic: z.string().optional(),
  produceContextKeys: z.array(z.string()).optional(),
});

export type TVerifyStageSnapshot = z.infer<typeof verifyStageSnapshotSchema>;

export const verifyResumeActionSchema = z.enum(['rerun', 'edit_answer', 'reask', 'follow_up']);

export type TVerifyResumeAction = z.infer<typeof verifyResumeActionSchema>;

export const verifyRequestSchema = z.object({
  contextSnapshot: z.record(z.string(), z.unknown()),
  minScore: z.number().min(0).max(1).optional(),
  requestId: z.string(),
  rubric: z.string().optional(),
  sessionId: z.string(),
  stageIndex: z.number().int().nonnegative(),
  stageSnapshot: verifyStageSnapshotSchema.optional(),
  stageVersion: z.number().int().positive().optional(),
  verifyResume: z.boolean().optional(),
  ...orgScopeSchema.shape,
});

export type TVerifyRequest = z.infer<typeof verifyRequestSchema>;

export const verifyResponseSchema = z.object({
  askUserRef: z.string().optional(),
  feedback: z.string(),
  pass: z.boolean(),
  resumeAction: verifyResumeActionSchema.optional(),
  score: z.number().min(0).max(1),
});

export type TVerifyResponse = z.infer<typeof verifyResponseSchema>;

export const notificationDirectionSchema = z.enum(['to_user', 'on_behalf_of_user']);

export const notificationChannelSchema = z.enum(['email', 'whatsapp']);

export const notificationProposalSchema = z.object({
  body: z.string(),
  channel: notificationChannelSchema,
  direction: notificationDirectionSchema,
  fromIdentity: z.string().optional(),
  sessionId: z.string().optional(),
  taskRef: z.string().optional(),
  templateRef: z.string().optional(),
  to: z.string(),
  ...orgScopeSchema.shape,
});

export type TNotificationProposalInput = z.infer<typeof notificationProposalSchema>;

export const settingProposalSchema = z.object({
  key: z.string(),
  patch: z.record(z.string(), z.unknown()),
  reason: z.string().optional(),
  ...orgScopeSchema.shape,
});

export type TSettingProposalInput = z.infer<typeof settingProposalSchema>;

export const proposalStatusSchema = z.enum(['pending', 'approved', 'rejected']);

export const pendingWorkItemSchema = z.object({
  approved: z.boolean(),
  approvedAt: z.string().optional(),
  done: z.boolean(),
  id: z.string(),
  kind: z.enum(['notification', 'setting']),
  payload: z.record(z.string(), z.unknown()),
});

export type TPendingWorkItem = z.infer<typeof pendingWorkItemSchema>;

export const cronJobSchema = z.object({
  enabled: z.boolean().default(true),
  id: z.string(),
  schedule: z.string(),
  taskPath: z.string(),
  timezone: z.string().optional(),
  ...orgScopeSchema.shape,
});

export type TCronJob = z.infer<typeof cronJobSchema>;
