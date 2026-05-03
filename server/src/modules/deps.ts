import type { createRunManager } from "../run-manager";

export type ServerRoutesDeps = {
  runManager: ReturnType<typeof createRunManager>;
};
