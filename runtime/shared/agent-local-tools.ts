export const AGENT_LOCAL_TOOLS = new Set(['browser', 'platform', 'run_bash']);

export const isAgentLocalTool = (name: string) => AGENT_LOCAL_TOOLS.has(name);
