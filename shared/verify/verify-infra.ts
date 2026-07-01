const VERIFY_INFRA_PATTERN =
  /already has active run|mastermind unavailable|worker unavailable|verify unavailable|auth failed|unauthenticated|not_logged_in|connecterror|timed out after|aborted|canceled|cancelled|stall|empty response|empty agent response|empty cli response|agent cli not found|enoent/i;

const SDK_STALL_ABORT_PATTERN = /aborted|canceled|cancelled|stall/i;

const SDK_AUTH_ERROR_PATTERN = /unauthenticated|not_logged_in|auth failed|connecterror/i;

export const isActiveRunError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);

  return /already has active run/i.test(message);
};

export const isSdkStallAbortError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);

  return SDK_STALL_ABORT_PATTERN.test(message);
};

export const isSdkAuthError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);

  return SDK_AUTH_ERROR_PATTERN.test(message);
};

export const isSdkRetryableError = (error: unknown): boolean =>
  isActiveRunError(error) || isSdkStallAbortError(error);

export const isVerifyInfraError = (message: string): boolean =>
  VERIFY_INFRA_PATTERN.test(message);

export const isCliEmptyResponse = (text: string): boolean => !text.trim();

export const formatVerifyCliSpawnError = (error: unknown): Error => {
  if (!(error instanceof Error)) {
    return new Error(String(error));
  }

  const message = error.message;

  if (error.name === 'ENOENT' || /spawn agent ENOENT/i.test(message)) {
    return new Error('agent CLI not found on PATH');
  }

  return error;
};
