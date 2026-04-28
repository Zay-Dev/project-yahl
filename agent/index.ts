import config from "./config";

const run = async () => {
  if (!config.apiKey) {
    process.stderr.write('[WARN] Running without API KEY');
  }

  const { startRedisDaemon } = await import("./redis-daemon");

  await startRedisDaemon();
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[Agent Error] ${message}\n`);
  process.exit(1);
});
