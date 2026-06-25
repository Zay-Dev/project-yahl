import type { TStorage } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { YahlStage } from '@/shared/yahl-stage';

import { fetchSession } from '@/orchestrator/-ask-user';
import { parsedStageFromSnapshot } from '@/orchestrator/-ask-user/parsed-stage-snapshot';
import { fetchTaskYahl } from '@/orchestrator/-tasks/session-api';
import { fetchVerifyCheckpoint } from '@/orchestrator/-verify/session-api';
import { deriveTaskIdFromYahlPath, parseYahlFile } from '@/orchestrator/-utils/yahl';
import { createStorage } from '@/orchestrator/-tools/set_context';
import { seedDefaultContext } from '@/orchestrator/-context/default-context';

export const deserializeCheckpointStorage = (snapshot: Record<string, unknown>): TStorage => {
  const context = snapshot.context;
  const types = snapshot.types;
  const storage = createStorage();

  if (context && typeof context === 'object' && !Array.isArray(context)) {
    Object.entries(context).forEach(([key, value]) => {
      storage.context.set(key, value);
    });
  }

  if (types && typeof types === 'object' && !Array.isArray(types)) {
    Object.entries(types).forEach(([key, value]) => {
      storage.types.set(key, value);
    });
  }

  seedDefaultContext(storage);

  return storage;
};

const resolveTaskId = (session: {
  taskId?: string;
  taskYahlPath?: string;
}) => {
  if (session.taskId?.trim()) {
    return session.taskId.trim();
  }

  if (!session.taskYahlPath?.trim()) {
    throw new Error('checkpoint resume: session missing taskId and taskYahlPath');
  }

  return deriveTaskIdFromYahlPath(session.taskYahlPath);
};

export const resolveResumeYahlStages = async (
  session: {
    parsedStages?: ParsedStage[];
    taskId?: string;
    taskYahlPath?: string;
  },
  readTaskFile: (taskId: string) => Promise<ParsedStage[]> = async (taskId) => {
    const task = await fetchTaskYahl(taskId);

    return parseYahlFile(task.yahl);
  },
): Promise<ParsedStage[]> => {
  const yahlStages = (session.parsedStages ?? []) as ParsedStage[];

  if (yahlStages.length) {
    return yahlStages;
  }

  const taskId = resolveTaskId(session);

  return readTaskFile(taskId);
};

export const loadCheckpointResumeContext = async (sessionId: string, verifyId: string) => {
  const checkpoint = await fetchVerifyCheckpoint(sessionId, verifyId);
  const session = await fetchSession(sessionId);
  const yahlStages = await resolveResumeYahlStages(session);
  const stageIndex = typeof checkpoint.stageIndex === 'number' ? checkpoint.stageIndex : 0;
  const storage = deserializeCheckpointStorage(checkpoint.storageSnapshot as Record<string, unknown>);

  const parsedSnapshot = checkpoint.parsedStageSnapshot as {
    lines: string;
    sourceStartLine: number;
    type: 'loop' | 'plain';
  } | undefined;

  const stageFromSnapshot = parsedSnapshot
    ? parsedStageFromSnapshot(checkpoint.stage as YahlStage, parsedSnapshot)
    : null;

  const activeStage = stageFromSnapshot ?? yahlStages[stageIndex];

  if (!activeStage) {
    throw new Error(`checkpoint resume: stage not found at index ${stageIndex}`);
  }

  return {
    activeStage,
    checkpoint,
    session,
    stageIndex,
    storage,
    yahlStages,
  };
};
