type TQueuedVerify<T> = () => Promise<T>;

const queue: TQueuedVerify<unknown>[] = [];
let active = false;

export const getVerifyQueueDepth = () => queue.length + (active ? 1 : 0);

export const enqueueVerify = <T>(task: TQueuedVerify<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    queue.push(async () => {
      try {
        resolve(await task());
      } catch (error) {
        reject(error);
      }
    });

    void drainQueue();
  });
};

const drainQueue = async () => {
  if (active) {
    return;
  }

  const next = queue.shift();

  if (!next) {
    return;
  }

  active = true;

  try {
    await next();
  } finally {
    active = false;
    void drainQueue();
  }
};

export const resetVerifyQueueForTests = () => {
  queue.length = 0;
  active = false;
};
