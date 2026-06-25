export type TResponseCronJobListItem = {
  createdAt: string;
  enabled: boolean;
  id: string;
  orgId?: string;
  orgUnitId?: string;
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
  schedule: string;
  taskPath: string;
  timezone?: string;
  userId?: string;
};

export type TRequestUpdateCronJobBody = {
  enabled?: boolean;
  orgId?: string;
  orgUnitId?: string;
  schedule?: string;
  taskPath?: string;
  timezone?: string;
  userId?: string;
};

export type TResponseCronJobMutation = {
  id: string;
  ok: true;
};
