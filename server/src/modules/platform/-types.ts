import type { TSoftDeletable, TWithTimestamps } from '@omni-infra/types/entities';

export type TProposalKind = 'notification' | 'setting';

export type TProposalStatus = 'pending' | 'approved' | 'rejected';

export interface IPlatformProposal extends TWithTimestamps {
  _id: string;
  approvedAt?: Date;
  done: boolean;
  doneAt?: Date;
  kind: TProposalKind;
  orgId?: string;
  orgUnitId?: string;
  payload: Record<string, unknown>;
  proposalId: string;
  reason?: string;
  status: TProposalStatus;
  userId?: string;
}

export interface ICronJob extends TSoftDeletable, TWithTimestamps {
  _id: string;
  enabled: boolean;
  id: string;
  orgId?: string;
  orgUnitId?: string;
  schedule: string;
  /** YAHL task id under server/tasks/ (e.g. hk_weather), not a filesystem path */
  taskPath: string;
  timezone?: string;
  userId?: string;
}

export type TRequestCreateNotificationProposal = {
  body: string;
  channel: 'email' | 'whatsapp';
  direction: 'to_user' | 'on_behalf_of_user';
  fromIdentity?: string;
  orgId?: string;
  orgUnitId?: string;
  sessionId?: string;
  taskRef?: string;
  templateRef?: string;
  to: string;
  userId?: string;
};

export type TRequestCreateSettingProposal = {
  key: string;
  orgId?: string;
  orgUnitId?: string;
  patch: Record<string, unknown>;
  reason?: string;
  userId?: string;
};

export type TResponseProposalCreated = {
  id: string;
};

export type TResponsePendingWork = {
  items: {
    approved: boolean;
    approvedAt?: string;
    done: boolean;
    id: string;
    kind: TProposalKind;
    payload: Record<string, unknown>;
  }[];
};

export type TResponseCronJobs = {
  items: ICronJob[];
};
