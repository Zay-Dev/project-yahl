import type { TResponseCronJob } from './-api-types';
import type { ICronJob } from './-types';

export const toCronJobResponse = (doc: ICronJob): TResponseCronJob => ({
  createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
  enabled: doc.enabled,
  id: doc.id,
  orgId: doc.orgId,
  orgUnitId: doc.orgUnitId,
  runInput: doc.runInput,
  schedule: doc.schedule,
  taskPath: doc.taskPath,
  timezone: doc.timezone,
  updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt),
  userId: doc.userId,
});
