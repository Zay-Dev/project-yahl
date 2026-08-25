import type { TResponseWhatsAppChannel } from "@project-yahl/server/modules/platform/-api-types";

import { useEffect, useState } from "react";

import { API_BASE_URL } from "@/providers/constants";

const POLL_MS = 5000;

export const fetchWhatsAppChannel = async (): Promise<TResponseWhatsAppChannel> => {
  const res = await fetch(`${API_BASE_URL}/api/platform/channels/whatsapp`);

  if (!res.ok) {
    throw new Error(`Failed to load WhatsApp channel (${res.status})`);
  }

  return res.json() as Promise<TResponseWhatsAppChannel>;
};

export const useWhatsAppChannel = () => {
  const [channel, setChannel] = useState<TResponseWhatsAppChannel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const next = await fetchWhatsAppChannel();

        if (!cancelled) {
          setChannel(next);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load channel");
        }
      }
    };

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return { channel, error };
};
