export const fetchWithConcurrency = async <T,>(
  items: string[],
  concurrency: number,
  fetcher: (id: string) => Promise<T>,
) => {
  const results = new Map<string, T>();
  let index = 0;

  const worker = async () => {
    while (index < items.length) {
      const current = items[index];

      index += 1;

      const value = await fetcher(current);

      results.set(current, value);
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );

  await Promise.all(workers);

  return results;
};
