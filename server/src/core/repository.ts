import type { ChildProcess } from 'child_process';

import type { TTaskSkillFile } from '@project-yahl/shared/yahl/task-skills';
import type { TParsedStage, TSessionRunCursor } from '@project-yahl/shared/yahl/types';

import type { TYahlDocument } from './-base-types';

import * as awilix from 'awilix';

type TServices = {
  createPendingSession: (input: {
    isBackground?: boolean;
    parsedStages?: TParsedStage[];
    resultContextKey?: string;
    runCursor?: TSessionRunCursor;
    runInput?: Record<string, unknown>;
    sessionId: string;
    storageSeed?: Record<string, unknown>;
    taskId: string;
    taskSkills?: TTaskSkillFile[];
    taskYahl: string;
  }) => Promise<void>;
  spawnOrchestrate: (sessionId: string, args: string[]) => Promise<ChildProcess>;
  sumUsageSince: (input: { since: Date }) => Promise<{
    completionTokens: number;
    promptTokens: number;
    since: string;
    totalTokens: number;
  }>;
  validateSessionById: (sessionId: string) => Promise<TYahlDocument>;
  validateTaskRunInput: (
    taskId: string,
    runInput?: Record<string, unknown>,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
};

const _container = awilix.createContainer<TServices>();

const _asValue = <K extends keyof TServices>(key: K) => {
  return (value: TServices[K]) => _container.register(key, awilix.asValue(value));
};

export namespace Repository {
  export const resolve = <K extends keyof TServices>(key: K) => _container.resolve(key);

  export const registerCreatePendingSession = _asValue('createPendingSession');

  export const registerSpawnOrchestrate = _asValue('spawnOrchestrate');

  export const registerSumUsageSince = _asValue('sumUsageSince');

  export const registerValidateSessionById = _asValue('validateSessionById');

  export const registerValidateTaskRunInput = _asValue('validateTaskRunInput');
}
