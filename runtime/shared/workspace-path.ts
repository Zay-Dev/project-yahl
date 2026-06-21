export const WORKSPACE_CONTAINER_ROOT = '/root';

export const workspaceContainerRoot = () =>
  process.env.AGENT_SESSION_HOME?.trim() || WORKSPACE_CONTAINER_ROOT;

export const resolveWorkspacePath = (input: string): string => {
  const trimmed = input.trim();
  const root = workspaceContainerRoot();

  if (trimmed.startsWith('~/')) {
    return `${root}/${trimmed.slice(2)}`;
  }

  if (trimmed === '~') {
    return root;
  }

  return trimmed;
};
