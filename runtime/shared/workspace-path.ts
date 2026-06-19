export const WORKSPACE_CONTAINER_ROOT = '/root';

export const resolveWorkspacePath = (input: string): string => {
  const trimmed = input.trim();

  if (trimmed.startsWith('~/')) {
    return `${WORKSPACE_CONTAINER_ROOT}/${trimmed.slice(2)}`;
  }

  if (trimmed === '~') {
    return WORKSPACE_CONTAINER_ROOT;
  }

  return trimmed;
};
