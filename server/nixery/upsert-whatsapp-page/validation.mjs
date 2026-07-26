export default async ({ output }) => {
  if (!output || typeof output !== 'object') {
    return { ok: false, error: 'missing output' };
  }

  if (output.ok !== true || !output.pagePath) {
    return { ok: false, error: output.error ?? 'upsert failed' };
  }

  return { ok: true };
};
