import type { TAgentTracker } from "./index";

export const createConsoleTracker = (): TAgentTracker => ({
  track: (event) => {
    console.log("[AgentTracker]", JSON.stringify(event, null, 2));
  },
  reset: () => {},
});
