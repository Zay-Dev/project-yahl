import path from 'path';

import {
  AGENT_SCRIPTS_DIR,
  assertScriptId,
  scriptFileName,
} from '@project-yahl/shared/yahl/knowledge-to-script';
import {
  taskScriptsDir,
  taskWorkspaceRoot,
} from '@project-yahl/shared/yahl/workspace-paths';

export { AGENT_SCRIPTS_DIR, taskScriptsDir, taskWorkspaceRoot };

export type TScriptArtifactKind = 'js' | 'meta' | 'recipe';

export const agentScriptPath = (scriptId: string, kind: TScriptArtifactKind) =>
  `${AGENT_SCRIPTS_DIR}/${scriptFileName(scriptId, kind)}`;

export const resolveScriptPath = (
  taskId: string,
  scriptId: string,
  kind: TScriptArtifactKind,
) => path.join(taskScriptsDir(taskId), scriptFileName(scriptId, kind));

export const normalizeScriptId = (scriptId: string) => {
  assertScriptId(scriptId);

  return scriptId.trim();
};

export const listScriptArtifacts = async (taskId: string) => {
  const { readdir } = await import('node:fs/promises');

  try {
    return await readdir(taskScriptsDir(taskId));
  } catch {
    return [];
  }
};

export const listScriptIds = async (taskId: string) => {
  const artifacts = await listScriptArtifacts(taskId);
  const ids = new Set<string>();

  for (const name of artifacts) {
    const jsMatch = name.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\.js$/);

    if (jsMatch?.[1]) {
      ids.add(jsMatch[1]);
      continue;
    }

    const recipeMatch = name.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\.recipe\.json$/);

    if (recipeMatch?.[1]) {
      ids.add(recipeMatch[1]);
    }
  }

  return [...ids].sort();
};
