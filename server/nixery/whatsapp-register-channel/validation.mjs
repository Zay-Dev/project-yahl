export default async ({ output }) => {
  if (!output || typeof output !== 'object') {
    return { ok: false, error: 'missing output' };
  }

  if (output.ok !== true) {
    return { ok: false, error: output.error ?? 'register failed' };
  }

  if (!output.channel?.folder || !output.channel?.chatId) {
    return { ok: false, error: 'missing channel.folder or channel.chatId' };
  }

  return { ok: true };
};
