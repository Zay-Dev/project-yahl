import { config } from '../config.js';

export type TWhatsAppChannelStatus = 'pending' | 'ready' | 'disconnected';

let warnedMissingWorkerToken = false;

const warnMissingWorkerTokenOnce = (): void => {
  if (warnedMissingWorkerToken) {
    return;
  }

  warnedMissingWorkerToken = true;
  console.warn(
    '[worker] WORKER_INTERNAL_TOKEN is unset — skipping WhatsApp channel state sync; '
    + '/platform/channels will stay disconnected until token is set in .env (server + worker)',
  );
};

const readResponseSnippet = async (res: Response): Promise<string> => {
  try {
    const text = (await res.text()).trim();

    return text.slice(0, 200);
  } catch {
    return '';
  }
};

export const putWhatsAppChannelState = async (body: {
  qrDataUrl?: string;
  status: TWhatsAppChannelStatus;
}): Promise<void> => {
  const token = process.env.WORKER_INTERNAL_TOKEN?.trim() ?? '';

  if (!token) {
    warnMissingWorkerTokenOnce();
    return;
  }

  const url = `${config.sessionApiBaseUrl}/api/platform/internal/whatsapp`;

  try {
    const res = await fetch(url, {
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Token': token,
      },
      method: 'PUT',
    });

    if (!res.ok) {
      const snippet = await readResponseSnippet(res);

      console.warn(
        `[worker] whatsapp channel state update failed HTTP ${res.status}${snippet ? `: ${snippet}` : ''}`,
      );
    }
  } catch (error) {
    console.warn('[worker] whatsapp channel state update error', error);
  }
};
