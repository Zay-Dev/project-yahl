import type { TLoopMeta, TStorage } from '@/shared/transports/-types';
import type { TPreparedRunInput } from './prepared-run-types';
import type { TOrchestratorRun } from '../-cli/resolve-orchestrator-run';

import { createStorage } from '@/orchestrator/-tools/set_context';
import { seedDefaultContext, seedRunInputContext } from '@/orchestrator/-context/default-context';
import { parseYahlRunInputKeys } from '@/orchestrator/-utils/yahl';
import { fetchSession } from '@/orchestrator/-ask-user';

import { deserializeCheckpointStorage } from './checkpoint-resume-load';
import { resolvePreparedResumeRun } from './resolve-prepared-resume';
import { buildRepairSystemAppend } from '@/orchestrator/-repair/repair-helpers';

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
    ? parseYahlRunInputKeys(taskYahl)
    : undefined;

  seedRunInputContext(storage, runInput, runInputContextKeys);
  seedDefaultContext(storage);
};

export const buildFreshRunStorage = (
  session: Pick<{ runInput?: Record<string, unknown>; storageSeed?: Record<string, unknown>; taskYahl: string }, 'runInput' | 'storageSeed' | 'taskYahl'>,
): TStorage => {
  const storage = session.storageSeed
    ? deserializeCheckpointStorage(session.storageSeed)
    : _emptyStorage();

  _seedFreshTaskStorage(storage, session.runInput, session.taskYahl);

  return storage;
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

  if (run.mode === 'user-pause-resume') {
    return resolvePreparedResumeRun(sessionId, run.resumeId, 'user-pause');
  }

  const session = await fetchSession(sessionId);

  if (!session.parsedStages.length) {
    throw new Error(`[orchestrator] session missing parsedStages sessionId=${sessionId}`);
  }

  if (session.runCursor?.kind === 'repair') {
    const stageIndex = session.runCursor.stageIndex;
    const repairInstruction = session.runCursor.repairInstruction?.trim();

    if (!repairInstruction) {
      throw new Error(`[orchestrator] repair run missing repairInstruction sessionId=${sessionId}`);
    }

    const storage = buildFreshRunStorage(session);

    return {
      cursor: {
        kind: 'repair',
        loopMeta: session.runCursor.loopMeta as TLoopMeta | undefined,
        repairInstruction,
        stageIndex,
      },
      parsedStages: session.parsedStages,
      resultContextKey: session.resultContextKey ?? 'result',
      storage,
      systemAppend: buildRepairSystemAppend(repairInstruction),
      taskYahl: session.taskYahl,
    };
  }

  const stageIndex = session.runCursor?.stageIndex ?? 0;
  const storage = buildFreshRunStorage(session);

  return {
    cursor: {
      kind: 'pipeline',
      loopMeta: session.runCursor?.loopMeta as TLoopMeta | undefined,
      ...(session.runCursor?.nestedIndex === undefined
        ? {}
        : { nestedIndex: session.runCursor.nestedIndex }),
      stageIndex,
    },
    parsedStages: session.parsedStages,
    resultContextKey: session.resultContextKey ?? 'result',
    storage,
    taskYahl: session.taskYahl,
  };
};
