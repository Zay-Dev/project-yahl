const _modelsName = {
  CronJobs: 'CronJobs',
  ForkSessions: 'ForkSessions',
  PlatformChannelStates: 'PlatformChannelStates',
  PlatformProposals: 'PlatformProposals',
  SessionAskUserQuestions: 'SessionAskUserQuestions',
  SessionModelResponses: 'SessionModelResponses',
  SessionVerifyCheckpoints: 'SessionVerifyCheckpoints',
  Sessions: 'Sessions',
  SessionToolCalls: 'SessionToolCalls',
  Stages: 'Stages',
} as const;

declare global {
  var modelsName: typeof _modelsName;
}

globalThis.modelsName = _modelsName;

export {};
