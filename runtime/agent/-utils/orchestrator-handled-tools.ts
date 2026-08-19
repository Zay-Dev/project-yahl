export const ORCHESTRATOR_HANDLED_TOOLS = ['set_context', 'extend_context', 'ask_user', 'nixery', 'goto_stage'] as const;

export type TOrchestratorHandledTool = (typeof ORCHESTRATOR_HANDLED_TOOLS)[number];

export const isOrchestratorHandledTool = (name: string): name is TOrchestratorHandledTool =>
  (ORCHESTRATOR_HANDLED_TOOLS as readonly string[]).includes(name);
