import fs from 'node:fs/promises';

const parseGateJson = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export async function validateOutput(ctx) {
  let raw = '';

  try {
    raw = await fs.readFile(ctx.outputPath, 'utf8');
  } catch {
    return { ok: false, reason: 'output file missing' };
  }

  const parsed = parseGateJson(raw);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'invalid json gate file' };
  }

  if (parsed.ok !== true) {
    return { ok: false, reason: parsed.error ?? 'register failed' };
  }

  if (!parsed.channel?.folder || !parsed.channel?.chatId) {
    return { ok: false, reason: 'missing channel.folder or channel.chatId' };
  }

  if (parsed.platform != null) {
    if (typeof parsed.platform !== 'object' || Array.isArray(parsed.platform)) {
      return { ok: false, reason: 'platform must be an object' };
    }

    if (!parsed.platform.chatId || !parsed.platform.displayName) {
      return { ok: false, reason: 'platform.chatId and platform.displayName required when set' };
    }
  }

  return { ok: true };
}
