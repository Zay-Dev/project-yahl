import type { TStorage } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { YahlStage } from '@/shared/yahl-stage';

import { runYahl } from '@/orchestrator/-agent';
import { createStorage } from '@/orchestrator/-tools/set_context';
import { fetchSession } from '@/orchestrator/-ask-user';
import { parsedStageFromSnapshot } from '@/orchestrator/-ask-user/parsed-stage-snapshot';
import { fetchVerifyCheckpoint } from '@/orchestrator/-verify/session-api';
import { parseYahlFile } from '@/orchestrator/-utils/yahl';

const _deserializeStorage = (snapshot: Record<string, unknown>): TStorage => {
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

  return storage;
};

export const runVerifyResume = async (sessionId: string, verifyId: string) => {
  const checkpoint = await fetchVerifyCheckpoint(sessionId, verifyId);
  const session = await fetchSession(sessionId);

  const yahlPath = session.taskYahlPath;

  if (!yahlPath) {
    throw new Error('verify resume: session missing taskYahlPath');
  }

  const yahl = await (await import('fs/promises')).readFile(yahlPath, 'utf8');
  const stageIndex = typeof checkpoint.stageIndex === 'number' ? checkpoint.stageIndex : 0;
  const storage = _deserializeStorage(checkpoint.storageSnapshot as Record<string, unknown>);

  const feedback = String(checkpoint.feedback ?? '');
  storage.context.set('verify_feedback', feedback);

  const parsedSnapshot = checkpoint.parsedStageSnapshot as {
    lines: string;
    sourceStartLine: number;
    type: 'loop' | 'plain';
  } | undefined;

  const stageFromSnapshot = parsedSnapshot
    ? parsedStageFromSnapshot(checkpoint.stage as YahlStage, parsedSnapshot)
    : null;

  const yahlStages = session.parsedStages?.length
    ? session.parsedStages as ParsedStage[]
    : parseYahlFile(yahl);

  const activeStage = stageFromSnapshot ?? yahlStages[stageIndex];

  if (!activeStage) {
    throw new Error(`verify resume: stage not found at index ${stageIndex}`);
  }

  const requestId = String(checkpoint.requestId ?? '');

  const { storage: resultStorage } = await runYahl(yahl, {
    resumeStage: {
      requestId,
      stage: activeStage,
    },
    stages: yahlStages,
    startFromStageIndex: stageIndex,
    useStorage: () => storage,
  });

  return {
    resultContextKey: session.resultContextKey ?? 'result',
    storage: resultStorage,
  };
};
