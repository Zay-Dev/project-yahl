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
    return { ok: false, reason: parsed.error ?? 'resolve failed' };
  }

  if (parsed.channel !== 'whatsapp' && parsed.channel !== 'email') {
    return { ok: false, reason: 'channel must be whatsapp or email' };
  }

  if (typeof parsed.to !== 'string' || !parsed.to.trim()) {
    return { ok: false, reason: 'to required' };
  }

  if (typeof parsed.isUser !== 'boolean') {
    return { ok: false, reason: 'isUser boolean required' };
  }

  if (typeof parsed.preference !== 'string') {
    return { ok: false, reason: 'preference string required' };
  }

  if (typeof parsed.name !== 'string') {
    return { ok: false, reason: 'name string required' };
  }

  return { ok: true };
}
