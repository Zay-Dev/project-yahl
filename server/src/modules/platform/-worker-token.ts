export const assertWorkerInternalToken = (headerValue: string | string[] | undefined): void => {
  const expected = process.env.WORKER_INTERNAL_TOKEN?.trim() ?? '';
  const provided = typeof headerValue === 'string' ? headerValue.trim() : '';

  if (!expected || provided !== expected) {
    throw errors.custom('invalid worker token', 401);
  }
};
