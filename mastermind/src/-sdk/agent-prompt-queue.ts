export const createPromptQueue = () => {
  let chain: Promise<void> = Promise.resolve();
  let pending = 0;

  return <T>(fn: () => Promise<T>): Promise<T> => {
    pending += 1;

    if (pending > 1) {
      console.log(`[mastermind] agent prompt queued depth=${pending}`);
    }

    const result = chain.then(async () => {
      try {
        return await fn();
      } finally {
        pending -= 1;
      }
    });

    chain = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  };
};
