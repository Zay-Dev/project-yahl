import type { TYahlDocument } from './-base-types';

import * as awilix from 'awilix';

type TServices = {
  validateSessionById: (sessionId: string) => Promise<TYahlDocument>;
};

const _container = awilix.createContainer<TServices>();

const _asValue = <K extends keyof TServices>(key: K) => {
  return (value: TServices[K]) => _container.register(key, awilix.asValue(value));
};

export namespace Repository {
  export const resolve = <K extends keyof TServices>(key: K) => _container.resolve(key);

  export const registerValidateSessionById = _asValue('validateSessionById');
}
