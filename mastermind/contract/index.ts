import { z } from 'zod';

export const WORKSPACE_CONTAINER_ROOT = '/root';

export const resolveSessionWorkspacePath = (input: string, sessionId: string): string => {
  const trimmed = input.trim();
  const sessionRoot = `${WORKSPACE_CONTAINER_ROOT}/sessions/${sessionId}`;

  if (trimmed.startsWith('~/')) {
    return `${sessionRoot}/${trimmed.slice(2)}`;
  }

  if (trimmed === '~') {
    return sessionRoot;
  }

  return trimmed;
};

export const resolveWorkspacePath = (input: string, sessionId?: string): string => {
  const trimmed = input.trim();

  if (sessionId && (trimmed.startsWith('~/') || trimmed === '~')) {
    return resolveSessionWorkspacePath(trimmed, sessionId);
  }

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
  'list-topic-policies',
  'resolve-topic-policy',
  'patch-topic-policy',
  'evaluate-knowledge-refresh',
  'dispatch-task-run',
  'propose-notification',
  'propose-knowledge-transfer',
  'get-knowledge-manager-instruction',
  'put-knowledge-manager-instruction',
] as const;

export type TSkillName = (typeof skillNames)[number];

export const skillRequestSchema = z.object({
  args: z.record(z.string(), z.unknown()).default({}),
  caller: z.enum(['stage-agent', 'orchestrator']).default('stage-agent'),
  invocationId: z.string().optional(),
  requestId: z.string().optional(),
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

export const requestActivityStatusSchema = z.enum(['failed', 'queued', 'running', 'succeeded']);

export type TRequestActivityStatus = z.infer<typeof requestActivityStatusSchema>;

export const requestActivityRecordSchema = z.object({
  error: z.string().optional(),
  invocationId: z.string().optional(),
  kind: z.enum(['skill', 'verify']),
  requestId: z.string(),
  resultData: z.string().optional(),
  sessionId: z.string(),
  skill: z.string().optional(),
  startedAt: z.string(),
  status: requestActivityStatusSchema,
  unavailable: z.boolean().optional(),
  updatedAt: z.string(),
});

export type TRequestActivityRecord = z.infer<typeof requestActivityRecordSchema>;

export const requestStatusQuerySchema = z.object({
  invocationId: z.string().trim().min(1).optional(),
  requestId: z.string().trim().min(1),
  sessionId: z.string().trim().min(1),
});

export type TRequestStatusQuery = z.infer<typeof requestStatusQuerySchema>;

export const requestStatusResponseSchema = z.object({
  agent: z.string(),
  error: z.string().optional(),
  ok: z.boolean(),
  queueDepth: z.number().int().nonnegative(),
  request: requestActivityRecordSchema.nullable(),
  unavailable: z.boolean().optional(),
});

export type TRequestStatusResponse = z.infer<typeof requestStatusResponseSchema>;

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

export const knowledgeTransferProposalSchema = z.object({
  claim: z.string(),
  example: z.string().optional(),
  evidence: z.record(z.string(), z.unknown()).optional(),
  observationIds: z.array(z.string()).optional(),
  proposedOps: z.array(z.unknown()).optional(),
  rationale: z.string(),
  sessionId: z.string().optional(),
  sourceTopic: z.string(),
  targetTopic: z.string(),
  ...orgScopeSchema.shape,
});

export type TKnowledgeTransferProposalInput = z.infer<typeof knowledgeTransferProposalSchema>;

export const proposalStatusSchema = z.enum(['pending', 'approved', 'rejected']);

export const pendingWorkItemSchema = z.object({
  approved: z.boolean(),
  approvedAt: z.string().optional(),
  done: z.boolean(),
  id: z.string(),
  kind: z.enum(['notification', 'setting', 'knowledge_transfer']),
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
