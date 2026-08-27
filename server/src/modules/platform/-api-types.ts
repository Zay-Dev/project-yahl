export type TResponseCronJobListItem = {
  createdAt: string;
  deleteAfterRun?: boolean;
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
  deleteAfterRun?: boolean;
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
  deleteAfterRun?: boolean;
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

export type TResponseWhatsAppChannel = {
  enabled: boolean;
  qrDataUrl?: string;
  status: 'connecting' | 'authenticated' | 'pending' | 'ready' | 'disconnected';
  updatedAt: string | null;
};

export type TRequestPutWhatsAppChannelBody = {
  qrDataUrl?: string;
  status: 'connecting' | 'authenticated' | 'pending' | 'ready' | 'disconnected';
};
