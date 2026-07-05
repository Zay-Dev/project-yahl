import type { TSessionFetch } from '@/orchestrator/-ask-user/session-api';
import type { TStorage } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { YahlStage } from '@/shared/yahl-stage';

import { fetchSession } from '@/orchestrator/-ask-user';
import { parsedStageFromSnapshot } from '@/orchestrator/-ask-user/parsed-stage-snapshot';
import { fetchVerifyCheckpoint } from '@/orchestrator/-verify/session-api';
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

export const resolveResumeYahlStages = (
  session: Pick<TSessionFetch, 'parsedStages'>,
): ParsedStage[] => {
  if (!session.parsedStages.length) {
    throw new Error('checkpoint resume: session missing parsedStages');
  }

  return session.parsedStages;
};

export const loadCheckpointResumeContext = async (sessionId: string, verifyId: string) => {
  const checkpoint = await fetchVerifyCheckpoint(sessionId, verifyId);
  const session = await fetchSession(sessionId);
  const yahlStages = resolveResumeYahlStages(session);
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
