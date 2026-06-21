import { config } from '../config.js';

export type TPendingItem = {
  approved: boolean;
  approvedAt?: string;
  done: boolean;
  id: string;
  kind: 'notification' | 'setting';
  payload: Record<string, unknown>;
};

export const fetchPendingApproved = async (): Promise<TPendingItem[]> => {
  const url = `${config.sessionApiBaseUrl}/api/platform/work/pending`;

  try {
    const res = await fetch(url);

    if (!res.ok) {
      console.warn('[worker] pending fetch failed', res.status);
      return [];
    }

    const data = await res.json() as { items?: TPendingItem[] };

    return data.items ?? [];
  } catch (error) {
    console.warn('[worker] pending fetch error', error);
    return [];
  }
};

export const markWorkDone = async (id: string, kind: 'notification' | 'setting') => {
  const url = `${config.sessionApiBaseUrl}/api/platform/work/${kind}/${encodeURIComponent(id)}/done`;

  await fetch(url, { method: 'POST' });
};

export const applySettingProposal = async (id: string) => {
  const url = `${config.sessionApiBaseUrl}/api/platform/proposals/settings/${encodeURIComponent(id)}/apply`;

  await fetch(url, { method: 'POST' });
};
