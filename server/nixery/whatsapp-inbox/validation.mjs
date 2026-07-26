export default async ({ output }) => {
  if (!output || typeof output !== 'object') {
    return { ok: false, error: 'missing output' };
  }

  if (output.ok !== true) {
    return { ok: false, error: output.error ?? 'inbox op failed' };
  }

  return { ok: true };
};
