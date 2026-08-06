const VERIFY_INFRA_PATTERN = /already has active run|mastermind unavailable|verify unavailable|auth failed|verification service/i;

export const isVerifyInfraFeedback = (feedback: string): boolean =>
  VERIFY_INFRA_PATTERN.test(feedback);
