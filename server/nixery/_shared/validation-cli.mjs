const DEF_VALIDATION_PATH = '/opt/nixery/def/validation.mjs';

const parseValidateContext = () => {
  const raw = process.env.NIXERY_VALIDATE_CTX?.trim();

  if (!raw) {
    throw new Error('NIXERY_VALIDATE_CTX is required');
  }

  const ctx = JSON.parse(raw);

  if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx)) {
    throw new Error('NIXERY_VALIDATE_CTX must be a JSON object');
  }

  if (typeof ctx.defId !== 'string' || !ctx.defId.trim()) {
    throw new Error('NIXERY_VALIDATE_CTX.defId is required');
  }

  if (typeof ctx.workspace !== 'string' || !ctx.workspace.trim()) {
    throw new Error('NIXERY_VALIDATE_CTX.workspace is required');
  }

  if (typeof ctx.outputPath !== 'string' || !ctx.outputPath.trim()) {
    throw new Error('NIXERY_VALIDATE_CTX.outputPath is required');
  }

  if (!ctx.input || typeof ctx.input !== 'object' || Array.isArray(ctx.input)) {
    throw new Error('NIXERY_VALIDATE_CTX.input must be an object');
  }

  return ctx;
};

const main = async () => {
  const ctx = parseValidateContext();
  const mod = await import(DEF_VALIDATION_PATH);

  if (typeof mod.validateOutput !== 'function') {
    throw new Error(`${DEF_VALIDATION_PATH} must export validateOutput`);
  }

  const result = await mod.validateOutput(ctx);

  if (!result?.ok) {
    const reason = typeof result?.reason === 'string' && result.reason.trim()
      ? result.reason.trim()
      : 'output validation failed';

    console.error(reason);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
