import type { TLoopMeta, TStorage } from '@/shared/transports/-types';
import type { TPreparedRunInput } from './prepared-run-types';
import type { TOrchestratorRun } from '../-cli/resolve-orchestrator-run';

import { createStorage } from '@/orchestrator/-tools/set_context';
import { seedDefaultContext, seedRunInputContext } from '@/orchestrator/-context/default-context';
import { parseYahlDocument } from '@/orchestrator/-utils/yahl';
import { fetchSession } from '@/orchestrator/-ask-user';

import { deserializeCheckpointStorage } from './checkpoint-resume-load';
import { resolvePreparedResumeRun } from './resolve-prepared-resume';

const _emptyStorage = () => {
  const storage = createStorage();

  seedDefaultContext(storage);

  return storage;
};

const _seedFreshTaskStorage = (
  storage: TStorage,
  runInput: Record<string, unknown> | undefined,
  taskYahl: string,
) => {
  const runInputContextKeys = taskYahl.trim()
    ? parseYahlDocument(taskYahl).runInput
    : undefined;

  seedRunInputContext(storage, runInput, runInputContextKeys);
  seedDefaultContext(storage);
};

export const resolvePreparedRun = async (
  sessionId: string,
  run: TOrchestratorRun,
): Promise<TPreparedRunInput> => {
  if (run.mode === 'ask-user-resume') {
    return resolvePreparedResumeRun(sessionId, run.resumeId, 'ask-user');
  }

  if (run.mode === 'verify-resume') {
    return resolvePreparedResumeRun(sessionId, run.resumeId, 'verify');
  }

  if (run.mode === 'produce-keys-resume') {
    return resolvePreparedResumeRun(sessionId, run.resumeId, 'produce-keys');
  }

  const session = await fetchSession(sessionId);

  if (!session.parsedStages.length) {
    throw new Error(`[orchestrator] session missing parsedStages sessionId=${sessionId}`);
  }

  const stageIndex = session.runCursor?.stageIndex ?? 0;
  const storage = session.storageSeed
    ? deserializeCheckpointStorage(session.storageSeed)
    : _emptyStorage();

  if (!session.storageSeed) {
    _seedFreshTaskStorage(storage, session.runInput, session.taskYahl);
  } else {
    seedDefaultContext(storage);
  }

  return {
    cursor: {
      kind: 'pipeline',
      loopMeta: session.runCursor?.loopMeta as TLoopMeta | undefined,
      stageIndex,
    },
    parsedStages: session.parsedStages,
    resultContextKey: session.resultContextKey ?? 'result',
    runInput: session.runInput,
    storage,
    taskYahl: session.taskYahl,
  };
};
