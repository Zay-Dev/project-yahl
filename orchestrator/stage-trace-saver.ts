import type { StageTokenTrace } from "../shared/transport";

export type StageTraceSaver = {
  saveStageTokenTrace: (trace: StageTokenTrace) => Promise<void> | void;
};

export const createConsoleStageTraceSaver = (): StageTraceSaver => ({
  saveStageTokenTrace: (trace) => {
    console.log("[StageTokenTrace]", JSON.stringify(trace));
  },
});
