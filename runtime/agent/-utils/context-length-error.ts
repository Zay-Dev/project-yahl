export const isContextLengthError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);

  return /maximum context length|context length|too many tokens|requested \d+ tokens/i.test(
    message,
  );
};
