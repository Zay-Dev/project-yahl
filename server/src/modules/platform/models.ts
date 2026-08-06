import type { ICronJob, IPlatformProposal } from './-types';

import type { Document } from 'mongoose';

import { model as createModel, Schema } from 'mongoose';

export type TDbPlatformProposal = IPlatformProposal & Document;
export type TDbCronJob = ICronJob & Document;

const proposalSchema = new Schema<TDbPlatformProposal>({
  approvedAt: model.d.optionalDate(),
  done: { default: false, required: true, type: Boolean },
  doneAt: model.d.optionalDate(),
  kind: model.d.requiredString(),
  orgId: model.d.optionalString(),
  orgUnitId: model.d.optionalString(),
  payload: model.d.mixed(),
  proposalId: model.d.requiredString(),
  reason: model.d.optionalString(),
  status: model.d.requiredString(),
  userId: model.d.optionalString(),
}, {
  collection: modelsName.PlatformProposals,
  timestamps: true,
});

proposalSchema.index({ proposalId: 1 }, { unique: true });
proposalSchema.index({ status: 1, done: 1, kind: 1 });

const cronJobSchema = new Schema<TDbCronJob>({
  deletedAt: model.d.deletedAt(),
  deleteAfterRun: { default: false, type: Boolean },
  enabled: { default: true, required: true, type: Boolean },
  id: model.d.requiredString(),
  orgId: model.d.optionalString(),
  orgUnitId: model.d.optionalString(),
  runInput: model.d.mixed(),
  schedule: model.d.requiredString(),
  taskPath: model.d.requiredString(),
  timezone: model.d.optionalString(),
  userId: model.d.optionalString(),
}, {
  collection: modelsName.CronJobs,
  timestamps: true,
});

cronJobSchema.index(
  { id: 1 },
  { partialFilterExpression: { deletedAt: null }, unique: true },
);

export const modelPlatformProposal = createModel<TDbPlatformProposal>(
  modelsName.PlatformProposals,
  proposalSchema,
);

export const modelCronJob = createModel<TDbCronJob>(
  modelsName.CronJobs,
  cronJobSchema,
);
