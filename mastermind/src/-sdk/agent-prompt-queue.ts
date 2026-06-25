let queueDepth = 0;

export const getPromptQueueDepth = () => queueDepth;

export const createPromptQueue = () => {
  let chain: Promise<void> = Promise.resolve();

  return <T>(fn: () => Promise<T>): Promise<T> => {
    queueDepth += 1;

    if (queueDepth > 1) {
      console.log(`[mastermind] agent prompt queued depth=${queueDepth}`);
    }

    const result = chain.then(async () => {
      try {
        return await fn();
      } finally {
        queueDepth -= 1;
      }
    });

    chain = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  };
};

export const resetPromptQueueDepthForTests = () => {
  queueDepth = 0;
};
