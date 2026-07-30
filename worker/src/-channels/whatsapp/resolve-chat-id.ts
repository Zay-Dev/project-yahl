import type { Client } from 'whatsapp-web.js';

export type TResolvedChatId = {
  canonical: string;
  lid?: string;
  raw: string;
};

export const resolveCanonicalChatId = async (
  wa: Client,
  rawChatId: string,
): Promise<TResolvedChatId | null> => {
  const raw = rawChatId.trim();

  if (!raw) {
    return null;
  }

  if (!raw.endsWith('@lid')) {
    return { canonical: raw, raw };
  }

  const rows = await wa.getContactLidAndPhone([raw]);
  const row = rows[0];
  const pn = typeof row?.pn === 'string' ? row.pn.trim() : '';
  const lid = typeof row?.lid === 'string' && row.lid.trim()
    ? row.lid.trim()
    : raw;

  if (!pn) {
    return null;
  }

  return { canonical: pn, lid, raw };
};
