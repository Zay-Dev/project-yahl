import * as Types from '@omni-infra/mongoose/types';

const _model: { d: typeof Types } = {
  d: { ...Types },
};

declare global {
  var model: typeof _model;
}

globalThis.model = _model;

export {};
