import type { TAgentTracker } from "./index";

const log = (kind: string, event: unknown) => {
  console.log(`[AgentTracker:${kind}]`, JSON.stringify(event, null, 2));
};

export const createConsoleTracker = (): TAgentTracker => ({
  finalResult: (event) => log("finalResult", event),
  modelResponse: (event) => log("modelResponse", event),
  pushRequest: (event) => log("pushRequest", event),
  reset: () => { },
  stageFinish: (event) => log("stageFinish", event),
  toolCall: (event) => log("toolCall", event),
});
