export const STAGE_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

export const STAGE_GOTO_COMMAND_PATTERN = /^\/stage\(([a-zA-Z][a-zA-Z0-9_-]*)\)$/;

export const MAX_SESSION_STAGE_GOTOS = 5;

export const STAGE_GOTO_REASON_KEY = 'stage_goto_reason';

export const STAGE_GOTO_FROM_KEY = 'stage_goto_from';

export const parseStageGotoCommand = (command: string): string | null => {
  const match = command.trim().match(STAGE_GOTO_COMMAND_PATTERN);

  return match?.[1] ?? null;
};

export const formatStageGotoCommand = (stageId: string) => `/stage(${stageId})`;
