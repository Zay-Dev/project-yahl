export {
  resolveDataWorkspaceRoot as resolveWorkspaceRoot,
  SESSION_TASK_DATA_DIR,
  sessionTaskDataPath,
  sessionWorkspaceRoot,
  taskWorkspaceRoot,
} from '@project-yahl/shared/yahl/workspace-paths';

export type {
  TCopySessionWorkspaceResult,
  TRemoveSessionWorkspaceResult,
} from '@project-yahl/shared/yahl/workspace-paths';

import {
  copySessionWorkspace as copySessionWorkspaceShared,
  ensureTaskWorkspace as ensureTaskWorkspaceShared,
  removeSessionWorkspace as removeSessionWorkspaceShared,
} from '@project-yahl/shared/yahl/workspace-paths';

export const copySessionWorkspace = (
  sourceSessionId: string,
  targetSessionId: string,
) => copySessionWorkspaceShared(sourceSessionId, targetSessionId, 'sessions');

export const ensureTaskWorkspace = (taskId: string) =>
  ensureTaskWorkspaceShared(taskId, 'sessions');

export const removeSessionWorkspace = (sessionId: string) =>
  removeSessionWorkspaceShared(sessionId, 'sessions');
