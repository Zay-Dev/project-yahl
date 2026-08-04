export type TResponseCronJobListItem = {
  createdAt: string;
  enabled: boolean;
  id: string;
  orgId?: string;
  orgUnitId?: string;
  runInput?: Record<string, string>;
  schedule: string;
  taskPath: string;
  timezone?: string;
  updatedAt: string;
  userId?: string;
};

export type TResponseCronJob = TResponseCronJobListItem;

export type TResponseCronJobs = {
  items: TResponseCronJobListItem[];
};

export type TRequestCronJobParams = {
  id: string;
};

export type TRequestCreateCronJobBody = {
  enabled?: boolean;
  id: string;
  orgId?: string;
  orgUnitId?: string;
  runInput?: Record<string, string>;
  schedule: string;
  taskPath: string;
  timezone?: string;
  userId?: string;
};

export type TRequestUpdateCronJobBody = {
  enabled?: boolean;
  orgId?: string;
  orgUnitId?: string;
  runInput?: Record<string, string>;
  schedule?: string;
  taskPath?: string;
  timezone?: string;
  userId?: string;
};

export type TResponseCronJobMutation = {
  id: string;
  ok: true;
};

export type TTopicRefreshInterval = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export type TTopicRefreshScope = 'studies' | 'facts' | 'synthesis' | 'summary';

export type TTopicRefreshPolicy = {
  enabled: boolean;
  interval: TTopicRefreshInterval | null;
  lastRunAt: string | null;
  lastRunSessionId: string | null;
  lastRunStatus: 'success' | 'failed' | 'skipped' | null;
  scopes: TTopicRefreshScope[];
};

export type TResponseTopicPolicy = {
  canonical: string;
  fileCount: number;
  learningContractTopic?: string;
  refresh: TTopicRefreshPolicy | null;
  seedUrlCount: number;
  studyKeyCount: number;
  updatedAt?: string;
};

export type TResponseTopicPolicies = {
  items: TResponseTopicPolicy[];
};

export type TRequestKnowledgePolicyParams = {
  slug: string;
};

export type TRequestPatchKnowledgePolicyBody = {
  enabled?: boolean;
  interval?: TTopicRefreshInterval | null;
  lastRunAt?: string | null;
  lastRunSessionId?: string | null;
  lastRunStatus?: 'success' | 'failed' | 'skipped' | null;
  scopes?: TTopicRefreshScope[];
};

export type TResponseKnowledgeManagerInstruction = {
  text: string;
};

export type TRequestPutKnowledgeManagerInstructionBody = {
  text: string;
};
