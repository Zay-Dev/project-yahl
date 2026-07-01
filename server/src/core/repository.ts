import type { ChildProcess } from 'child_process';

import type { TYahlDocument } from './-base-types';

import * as awilix from 'awilix';

type TServices = {
  createPendingSession: (input: {
    isBackground?: boolean;
    runInput?: Record<string, unknown>;
    sessionId: string;
    taskId: string;
    taskYahlPath: string;
  }) => Promise<void>;
  spawnOrchestrate: (sessionId: string, args: string[]) => Promise<ChildProcess>;
  validateSessionById: (sessionId: string) => Promise<TYahlDocument>;
};

const _container = awilix.createContainer<TServices>();

const _asValue = <K extends keyof TServices>(key: K) => {
  return (value: TServices[K]) => _container.register(key, awilix.asValue(value));
};

export namespace Repository {
  export const resolve = <K extends keyof TServices>(key: K) => _container.resolve(key);

  export const registerCreatePendingSession = _asValue('createPendingSession');

  export const registerSpawnOrchestrate = _asValue('spawnOrchestrate');

  export const registerValidateSessionById = _asValue('validateSessionById');
}
