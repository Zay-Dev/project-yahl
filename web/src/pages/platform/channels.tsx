import type { TResponseWhatsAppChannel } from "@project-yahl/server/modules/platform/-api-types";

import { useEffect, useState } from "react";

import { API_BASE_URL } from "@/providers/constants";

const statusClass = (status: TResponseWhatsAppChannel["status"]) => {
  if (status === "ready") {
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "pending") {
    return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  }

  return "bg-muted text-muted-foreground";
};

const fetchWhatsAppChannel = async (): Promise<TResponseWhatsAppChannel> => {
  const res = await fetch(`${API_BASE_URL}/api/platform/channels/whatsapp`);

  if (!res.ok) {
    throw new Error(`Failed to load WhatsApp channel (${res.status})`);
  }

  return res.json() as Promise<TResponseWhatsAppChannel>;
};

export function PlatformChannelsPage() {
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
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const status = channel?.status ?? "disconnected";

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Platform channels</h1>
        <p className="text-sm text-muted-foreground">
          WhatsApp Web login status for the worker. Scan the QR when pending.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-lg font-medium">WhatsApp</h2>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass(status)}`}>
            {status}
          </span>
        </div>

        {status === "pending" && channel?.qrDataUrl ? (
          <img
            alt="WhatsApp login QR code"
            className="mx-auto max-w-xs rounded-lg border bg-white p-4"
            src={channel.qrDataUrl}
          />
        ) : null}

        {status === "ready" ? (
          <p className="text-sm text-muted-foreground">Connected. Outbound WhatsApp is available.</p>
        ) : null}

        {status === "disconnected" ? (
          <p className="text-sm text-muted-foreground">
            Not connected. Enable WhatsApp on the worker and wait for a QR code.
          </p>
        ) : null}

        {channel?.updatedAt ? (
          <p className="mt-4 text-xs text-muted-foreground">Updated {channel.updatedAt}</p>
        ) : null}
      </section>
    </div>
  );
}
