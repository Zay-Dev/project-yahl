import mongoose, { Schema } from "mongoose";

export type ForkrunFormDoc = {
  anchorStageIndex: number;
  requestSnapshotOverride: {
    context: {
      context: Record<string, unknown>;
      stage: Record<string, unknown>;
      types: Record<string, unknown>;
    };
    currentStage: string;
  };
  sourceRequestId: string;
  sourceSessionId: string;
  sourceStageId: string;
};

const requestSnapshotOverrideSchema = new Schema(
  {
    context: {
      context: { required: true, type: Schema.Types.Mixed },
      stage: { required: true, type: Schema.Types.Mixed },
      types: { required: true, type: Schema.Types.Mixed },
    },
    currentStage: { required: true, type: String },
  },
  { _id: false },
);

const forkrunFormSchema = new Schema<ForkrunFormDoc>(
  {
    anchorStageIndex: { required: true, type: Number },
    requestSnapshotOverride: { required: true, type: requestSnapshotOverrideSchema },
    sourceRequestId: { required: true, type: String },
    sourceSessionId: { index: true, required: true, type: String },
    sourceStageId: { required: true, type: String },
  },
  { collection: "forkrun_forms", timestamps: true },
);

export const ForkrunForm = mongoose.model<ForkrunFormDoc>("ForkrunForm", forkrunFormSchema);
