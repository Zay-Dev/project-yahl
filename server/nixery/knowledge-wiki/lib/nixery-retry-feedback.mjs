export const readNixeryRetryFeedback = (input) => {
  const retry = input?.nixeryRetry;

  if (!retry || typeof retry !== 'object' || Array.isArray(retry)) {
    return null;
  }

  const feedback = typeof retry.feedback === 'string' ? retry.feedback.trim() : '';

  return feedback || null;
};

export const readNixeryRetryMeta = (input) => {
  const retry = input?.nixeryRetry;

  if (!retry || typeof retry !== 'object' || Array.isArray(retry)) {
    return {
      attempt: 0,
      isFinalAttempt: true,
      maxAttempts: 1,
    };
  }

  const attempt = Number(retry.attempt);
  const maxAttempts = Number(retry.maxAttempts);

  return {
    attempt: Number.isFinite(attempt) && attempt >= 0 ? Math.floor(attempt) : 0,
    isFinalAttempt: retry.isFinalAttempt === true,
    maxAttempts: Number.isFinite(maxAttempts) && maxAttempts >= 1 ? Math.floor(maxAttempts) : 1,
  };
};

export const buildNixeryRetryUserMessage = (feedback) => ({
  content: [
    'Previous nixery attempt failed validation/output checks:',
    feedback,
    'Fix the failure and produce the required output. Do not repeat the same mistake.',
  ].join('\n'),
  role: 'user',
});

export const appendNixeryRetryUserMessage = (messages, feedback) => {
  const trimmed = typeof feedback === 'string' ? feedback.trim() : '';

  if (!trimmed) {
    return messages;
  }

  messages.push(buildNixeryRetryUserMessage(trimmed));

  return messages;
};
