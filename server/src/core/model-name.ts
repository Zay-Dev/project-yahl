const _modelsName = {
  ForkSessions: 'ForkSessions',
  SessionModelResponses: 'SessionModelResponses',
  Sessions: 'Sessions',
  SessionToolCalls: 'SessionToolCalls',
  Stages: 'Stages',
} as const;

declare global {
  var modelsName: typeof _modelsName;
}

globalThis.modelsName = _modelsName;

export {};
