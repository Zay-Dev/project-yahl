export const ORCHESTRATOR_HANDLED_TOOLS = ['set_context', 'ask_user', 'nixery'] as const;

export type TOrchestratorHandledTool = (typeof ORCHESTRATOR_HANDLED_TOOLS)[number];

export const isOrchestratorHandledTool = (name: string): name is TOrchestratorHandledTool =>
  (ORCHESTRATOR_HANDLED_TOOLS as readonly string[]).includes(name);
